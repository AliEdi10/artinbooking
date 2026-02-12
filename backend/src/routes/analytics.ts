import express from 'express';
import { authenticateRequest } from '../middleware/authentication';
import { requireRoles } from '../middleware/authorization';
import { AuthenticatedRequest } from '../types/auth';
import { query } from '../db';
import { listAuditLogs } from '../repositories/auditLogs';
import { getDriverProfileByUserId } from '../repositories/driverProfiles';

const router = express.Router();

/**
 * Helper to resolve school context
 */
function resolveSchoolContext(req: AuthenticatedRequest, res: express.Response): number | null {
    const schoolId = req.user?.drivingSchoolId;
    if (!schoolId) {
        res.status(403).json({ error: 'No school context' });
        return null;
    }
    return schoolId;
}

/**
 * GET /schools/:schoolId/analytics/summary
 * Dashboard summary stats
 */
router.get('/schools/:schoolId/analytics/summary', authenticateRequest, requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']), async (req, res) => {
    const schoolId = resolveSchoolContext(req as AuthenticatedRequest, res);
    if (!schoolId) return;

    try {
        // Total counts
        const [driversResult, studentsResult, bookingsResult] = await Promise.all([
            query<{ count: string }>('SELECT COUNT(*) FROM driver_profiles WHERE driving_school_id = $1 AND active = true', [schoolId]),
            query<{ count: string }>('SELECT COUNT(*) FROM student_profiles WHERE driving_school_id = $1', [schoolId]),
            query<{ count: string }>("SELECT COUNT(*) FROM bookings WHERE driving_school_id = $1 AND status = 'scheduled'", [schoolId]),
        ]);

        // This week's completed lessons
        const thisWeekResult = await query<{ count: string }>(
            `SELECT COUNT(*) FROM bookings 
       WHERE driving_school_id = $1 
       AND status = 'completed'
       AND start_time >= date_trunc('week', CURRENT_DATE)`,
            [schoolId]
        );

        // This month's completed lessons
        const thisMonthResult = await query<{ count: string }>(
            `SELECT COUNT(*) FROM bookings 
       WHERE driving_school_id = $1 
       AND status = 'completed'
       AND start_time >= date_trunc('month', CURRENT_DATE)`,
            [schoolId]
        );

        // Cancellation rate this month
        const cancellationsResult = await query<{ total: string; cancelled: string }>(
            `SELECT 
         COUNT(*) FILTER (WHERE status IN ('scheduled', 'completed', 'cancelled_by_student', 'cancelled_by_driver', 'cancelled_by_school')) as total,
         COUNT(*) FILTER (WHERE status IN ('cancelled_by_student', 'cancelled_by_driver', 'cancelled_by_school')) as cancelled
       FROM bookings 
       WHERE driving_school_id = $1 
       AND start_time >= date_trunc('month', CURRENT_DATE)`,
            [schoolId]
        );

        const total = parseInt(cancellationsResult.rows[0]?.total || '0', 10);
        const cancelled = parseInt(cancellationsResult.rows[0]?.cancelled || '0', 10);
        const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

        res.json({
            totalDrivers: parseInt(driversResult.rows[0].count, 10),
            totalStudents: parseInt(studentsResult.rows[0].count, 10),
            upcomingBookings: parseInt(bookingsResult.rows[0].count, 10),
            lessonsThisWeek: parseInt(thisWeekResult.rows[0].count, 10),
            lessonsThisMonth: parseInt(thisMonthResult.rows[0].count, 10),
            cancellationRatePercent: cancellationRate,
        });
    } catch (error) {
        console.error('Analytics summary error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

/**
 * GET /schools/:schoolId/analytics/bookings-by-week
 * Weekly booking counts for the last 8 weeks
 */
router.get('/schools/:schoolId/analytics/bookings-by-week', authenticateRequest, requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']), async (req, res) => {
    const schoolId = resolveSchoolContext(req as AuthenticatedRequest, res);
    if (!schoolId) return;

    try {
        const result = await query<{ week_start: Date; completed: string; scheduled: string; cancelled: string }>(
            `SELECT 
         date_trunc('week', start_time) as week_start,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
         COUNT(*) FILTER (WHERE status IN ('cancelled_by_student', 'cancelled_by_driver', 'cancelled_by_school')) as cancelled
       FROM bookings 
       WHERE driving_school_id = $1 
       AND start_time >= CURRENT_DATE - INTERVAL '8 weeks'
       GROUP BY date_trunc('week', start_time)
       ORDER BY week_start`,
            [schoolId]
        );

        res.json(result.rows.map(row => ({
            weekStart: row.week_start,
            completed: parseInt(row.completed, 10),
            scheduled: parseInt(row.scheduled, 10),
            cancelled: parseInt(row.cancelled, 10),
        })));
    } catch (error) {
        console.error('Bookings by week error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly data' });
    }
});

/**
 * GET /schools/:schoolId/analytics/driver-utilization
 * Per-driver stats
 */
router.get('/schools/:schoolId/analytics/driver-utilization', authenticateRequest, requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']), async (req, res) => {
    const schoolId = resolveSchoolContext(req as AuthenticatedRequest, res);
    if (!schoolId) return;

    try {
        const result = await query<{
            driver_id: number;
            full_name: string;
            total_bookings: string;
            completed: string;
            cancelled: string;
            hours: string;
        }>(
            `SELECT 
         d.id as driver_id,
         d.full_name,
         COUNT(b.id) as total_bookings,
         COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed,
         COUNT(b.id) FILTER (WHERE b.status IN ('cancelled_by_student', 'cancelled_by_driver', 'cancelled_by_school')) as cancelled,
         COALESCE(SUM(EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 3600) FILTER (WHERE b.status = 'completed'), 0) as hours
       FROM driver_profiles d
       LEFT JOIN bookings b ON b.driver_id = d.id AND b.start_time >= CURRENT_DATE - INTERVAL '30 days'
       WHERE d.driving_school_id = $1 AND d.active = true
       GROUP BY d.id, d.full_name
       ORDER BY total_bookings DESC`,
            [schoolId]
        );

        res.json(result.rows.map(row => ({
            driverId: row.driver_id,
            fullName: row.full_name,
            totalBookings: parseInt(row.total_bookings, 10),
            completedLessons: parseInt(row.completed, 10),
            cancelledLessons: parseInt(row.cancelled, 10),
            hoursWorked: Math.round(parseFloat(row.hours) * 10) / 10,
        })));
    } catch (error) {
        console.error('Driver utilization error:', error);
        res.status(500).json({ error: 'Failed to fetch driver stats' });
    }
});

/**
 * GET /schools/:schoolId/drivers/:driverId/earnings
 * Driver earnings summary
 */
router.get('/schools/:schoolId/drivers/:driverId/earnings', authenticateRequest, requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER']), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const schoolId = resolveSchoolContext(authReq, res);
    if (!schoolId) return;
    const driverId = parseInt(req.params.driverId, 10);

    // Drivers can only view their own earnings
    if (authReq.user?.role === 'DRIVER') {
        const driverProfile = await getDriverProfileByUserId(authReq.user.id, schoolId);
        if (!driverProfile || driverProfile.id !== driverId) {
            return res.status(403).json({ error: 'Drivers may only view their own earnings' });
        }
    }

    try {
        const driverResult = await query<{ full_name: string }>(
            'SELECT full_name FROM driver_profiles WHERE id = $1 AND driving_school_id = $2',
            [driverId, schoolId]
        );

        if (driverResult.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        // Get completed lessons with hours
        const lessonsResult = await query<{
            period: string;
            lessons: string;
            hours: string;
        }>(
            `SELECT
         to_char(date_trunc('week', start_time), 'YYYY-MM-DD') as period,
         COUNT(*) as lessons,
         COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0) as hours
       FROM bookings
       WHERE driver_id = $1
       AND driving_school_id = $2
       AND status = 'completed'
       AND start_time >= CURRENT_DATE - INTERVAL '12 weeks'
       GROUP BY date_trunc('week', start_time)
       ORDER BY period DESC`,
            [driverId, schoolId]
        );

        const weeklyData = lessonsResult.rows.map(row => ({
            weekStart: row.period,
            lessons: parseInt(row.lessons, 10),
            hours: Math.round(parseFloat(row.hours) * 10) / 10,
        }));

        // Calculate totals
        const totalHours = weeklyData.reduce((sum, w) => sum + w.hours, 0);
        const totalLessons = weeklyData.reduce((sum, w) => sum + w.lessons, 0);

        res.json({
            driverName: driverResult.rows[0].full_name,
            weeklyData,
            totals: {
                lessons: totalLessons,
                hours: Math.round(totalHours * 10) / 10,
            },
        });
    } catch (error) {
        console.error('Driver earnings error:', error);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
});

/**
 * GET /schools/:schoolId/drivers/:driverId/earnings/export
 * CSV export of driver earnings
 */
router.get('/schools/:schoolId/drivers/:driverId/earnings/export', authenticateRequest, requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER']), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const schoolId = resolveSchoolContext(authReq, res);
    if (!schoolId) return;
    const driverId = parseInt(req.params.driverId, 10);

    // Drivers can only export their own earnings
    if (authReq.user?.role === 'DRIVER') {
        const driverProfile = await getDriverProfileByUserId(authReq.user.id, schoolId);
        if (!driverProfile || driverProfile.id !== driverId) {
            return res.status(403).json({ error: 'Drivers may only export their own earnings' });
        }
    }

    try {
        const driverResult = await query<{ full_name: string }>(
            'SELECT full_name FROM driver_profiles WHERE id = $1 AND driving_school_id = $2',
            [driverId, schoolId]
        );

        if (driverResult.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        // Get all completed bookings
        const bookingsResult = await query<{
            start_time: Date;
            end_time: Date;
            student_name: string;
        }>(
            `SELECT b.start_time, b.end_time, s.full_name as student_name
       FROM bookings b
       JOIN student_profiles s ON s.id = b.student_id
       WHERE b.driver_id = $1
       AND b.driving_school_id = $2
       AND b.status = 'completed'
       ORDER BY b.start_time DESC`,
            [driverId, schoolId]
        );

        // Build CSV
        const csvRows = ['Date,Start Time,End Time,Student,Duration (hours)'];
        for (const row of bookingsResult.rows) {
            const duration = (new Date(row.end_time).getTime() - new Date(row.start_time).getTime()) / (1000 * 60 * 60);
            const studentName = row.student_name.replace(/"/g, '""');
            csvRows.push([
                new Date(row.start_time).toLocaleDateString(),
                new Date(row.start_time).toLocaleTimeString(),
                new Date(row.end_time).toLocaleTimeString(),
                `"${studentName}"`,
                duration.toFixed(2),
            ].join(','));
        }

        const safeFilename = driverResult.rows[0].full_name.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="earnings-${safeFilename}.csv"`);
        res.send(csvRows.join('\n'));
    } catch (error) {
        console.error('Earnings export error:', error);
        res.status(500).json({ error: 'Failed to export earnings' });
    }
});

/**
 * GET /schools/:schoolId/audit-logs
 * Get audit logs for school
 */
router.get('/schools/:schoolId/audit-logs', authenticateRequest, requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']), async (req, res) => {
    const schoolId = resolveSchoolContext(req as AuthenticatedRequest, res);
    if (!schoolId) return;

    try {
        const limit = parseInt(req.query.limit as string, 10) || 50;
        const offset = parseInt(req.query.offset as string, 10) || 0;
        const entityType = req.query.entityType as string | undefined;

        const result = await listAuditLogs(schoolId, { limit, offset, entityType });
        res.json(result);
    } catch (error) {
        console.error('Audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

export default router;
