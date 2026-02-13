import crypto from 'crypto';
import cors from 'cors';
import express from 'express';
import { authenticateRequest, authenticateRequestAllowUnregistered } from './middleware/authentication';
import { enforceTenantScope, requireRoles } from './middleware/authorization';
import { getDrivingSchoolById, getDrivingSchools, createDrivingSchool, activateDrivingSchool, updateDrivingSchool, updateDrivingSchoolStatus } from './repositories/drivingSchools';
import { findInvitationByToken, markInvitationAccepted, upsertInvitation, getPendingInvitations, getInvitationById, resendInvitation, deleteInvitation } from './repositories/invitations';
import { countAdminsForSchool, createUserWithIdentity, createUserWithPassword, getUserById, listUsersByRole } from './repositories/users';
import {
  createDriverProfile,
  getDriverProfileById,
  getDriverProfileByUserId,
  listDriverProfiles,
  updateDriverProfile,
} from './repositories/driverProfiles';
import {
  CreateStudentProfileInput,
  createStudentProfile,
  getStudentProfileById,
  getStudentProfileByUserId,
  listStudentProfiles,
  updateStudentProfile,
} from './repositories/studentProfiles';
import { createAddress, getAddressById, getAddressesByIds, listAddressesForStudent, listAddressesForStudents, updateAddress } from './repositories/studentAddresses';
import { cancelBooking, completeBooking, createBooking, createBookingAtomic, getBookingById, listBookings, updateBooking, rescheduleBookingAtomic, countScheduledBookingsForStudentOnDate, getTotalBookedHoursForStudent, checkBookingOverlap } from './repositories/bookings';
import { createAvailability, deleteAvailability, listAvailability, getDriverHolidaysForSchool } from './repositories/driverAvailability';
import { getSchoolSettings, upsertSchoolSettings } from './repositories/schoolSettings';
import { UserRole } from './models';
import { AuthenticatedRequest } from './types/auth';
import { AvailabilityRequest, BookingWithLocations, computeAvailableSlots, Location } from './services/availability';
import { buildGoogleMapsTravelCalculatorFromEnv } from './services/travelProvider';
import { issueLocalJwt } from './services/jwtIssuer';
import { verifyJwtFromRequest } from './services/jwtVerifier';
import { hashPassword } from './services/password';
import { sendInvitationEmail, sendBookingConfirmationEmail, sendBookingCancellationEmail, sendDriverBookingNotification } from './services/email';

async function resolveSchoolContext(req: AuthenticatedRequest, res: express.Response): Promise<number | null> {
  const requestedSchoolId = Number(req.params.schoolId);
  if (Number.isNaN(requestedSchoolId)) {
    res.status(400).json({ error: 'Invalid school id' });
    return null;
  }

  const tenantSchoolId = enforceTenantScope(req, res);
  if (tenantSchoolId === null && req.user?.role !== 'SUPERADMIN') {
    return null;
  }

  if (tenantSchoolId && tenantSchoolId !== requestedSchoolId) {
    res.status(403).json({ error: 'Cross-tenant access not allowed' });
    return null;
  }

  // Block non-SUPERADMIN access to non-active schools
  if (req.user?.role !== 'SUPERADMIN') {
    const school = await getDrivingSchoolById(requestedSchoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return null;
    }
    if (school.status !== 'active') {
      res.status(403).json({ error: 'School is not active' });
      return null;
    }
  }

  return requestedSchoolId;
}

const travelCalculator = buildGoogleMapsTravelCalculatorFromEnv();

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

function addressToLocation(address?: { latitude: number | null; longitude: number | null } | null): Location | null {
  if (!address || address.latitude === null || address.longitude === null) return null;
  return { latitude: Number(address.latitude), longitude: Number(address.longitude) };
}

function coerceNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const numeric = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : undefined;
}

async function buildDriverDayBookings(
  drivingSchoolId: number,
  driverId: number,
  date: Date,
): Promise<BookingWithLocations[]> {
  const bookings = await listBookings(drivingSchoolId, { driverId });

  const dateStr = date.toISOString().slice(0, 10);
  const dayBookings = bookings.filter(
    (b) => b.status === 'scheduled' && b.startTime.toISOString().slice(0, 10) === dateStr,
  );

  // Batch-load all addresses in one query instead of N+1
  const addressIds: number[] = [];
  for (const booking of dayBookings) {
    if (booking.pickupAddressId) addressIds.push(booking.pickupAddressId);
    if (booking.dropoffAddressId) addressIds.push(booking.dropoffAddressId);
  }
  const addressMap = await getAddressesByIds(addressIds, drivingSchoolId);

  const enriched: BookingWithLocations[] = [];
  for (const booking of dayBookings) {
    const pickupAddress = booking.pickupAddressId ? addressMap.get(booking.pickupAddressId) ?? null : null;
    const dropoffAddress = booking.dropoffAddressId ? addressMap.get(booking.dropoffAddressId) ?? null : null;

    const pickupLocation = addressToLocation(pickupAddress);
    const dropoffLocation = addressToLocation(dropoffAddress);
    if (!pickupLocation || !dropoffLocation) {
      throw new Error('Existing booking is missing location data');
    }

    enriched.push({ ...booking, pickupLocation, dropoffLocation });
  }

  return enriched;
}

import authRouter from './routes/auth';
import analyticsRouter from './routes/analytics';
import { generalLimiter, authLimiter, slotQueryLimiter, mutationLimiter } from './middleware/rateLimit';
import { httpLogger, logger } from './middleware/logging';
import { query, getPool } from './db';

const serverStartTime = Date.now();

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function createApp() {
  const app = express();

  // Trust first proxy (Railway) so express-rate-limit uses X-Forwarded-For correctly
  app.set('trust proxy', 1);

  // Request logging (first, to capture all requests)
  app.use(httpLogger);

  // CORS configuration - whitelist allowed origins
  const allowedOrigins = [
    'https://artinbooking.vercel.app',
    'https://booking.artindriving.ca',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  // Apply general rate limiting to all routes (200 req/min safety net)
  app.use(generalLimiter);
  // Apply stricter rate limiting to write operations (60 req/min for POST/PUT/PATCH/DELETE)
  app.use(mutationLimiter);

  // Apply stricter rate limiting to auth routes
  app.use('/auth', authLimiter, authRouter);

  // Mount analytics routes
  app.use(analyticsRouter);

  app.get('/health', async (_req, res) => {
    const start = Date.now();
    try {
      await query('SELECT 1');
      const dbLatencyMs = Date.now() - start;
      res.json({ status: 'ok', dbLatencyMs });
    } catch {
      res.status(503).json({ status: 'degraded', dbLatencyMs: null });
    }
  });

  app.get('/system/status', authenticateRequest, requireRoles(['SUPERADMIN']), async (_req, res) => {
    const uptimeMs = Date.now() - serverStartTime;
    const mem = process.memoryUsage();
    const pool = getPool();

    // DB latency check
    let dbStatus = 'degraded';
    let dbLatencyMs: number | null = null;
    const start = Date.now();
    try {
      await query('SELECT 1');
      dbLatencyMs = Date.now() - start;
      dbStatus = 'ok';
    } catch {
      // leave degraded
    }

    res.json({
      uptime: {
        ms: uptimeMs,
        formatted: formatUptime(uptimeMs),
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        pool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      node: process.version,
    });
  });

  app.get('/hello', (_req, res) => {
    res.json({ message: 'Hello from artinbk backend' });
  });

  app.post('/auth/local-token', authLimiter, (req, res) => {
    if (process.env.AUTH_LOCAL_JWT !== 'true') {
      res.status(404).json({ error: 'Local token issuance is disabled' });
      return;
    }

    const { sub, email, role, drivingSchoolId, expiresInSeconds } = req.body as {
      sub?: string;
      email?: string;
      role?: string;
      drivingSchoolId?: number | null;
      expiresInSeconds?: number;
    };

    if (!sub || !email) {
      res.status(400).json({ error: 'sub and email are required' });
      return;
    }

    try {
      const token = issueLocalJwt({ sub, email, role, drivingSchoolId, expiresInSeconds });
      res.json({ token });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get(
    '/schools',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const tenantSchoolId = enforceTenantScope(req, res);
        if (tenantSchoolId === null && req.user?.role !== 'SUPERADMIN') {
          return;
        }

        if (req.user?.role === 'SUPERADMIN') {
          const schools = await getDrivingSchools();
          res.json(schools);
          return;
        }

        if (!tenantSchoolId) {
          res.status(403).json({ error: 'Driving school required' });
          return;
        }

        const school = await getDrivingSchoolById(tenantSchoolId);
        if (!school) {
          res.status(404).json({ error: 'Driving school not found' });
          return;
        }

        res.json([school]);
      } catch (error) {
        next(error);
      }
    },
  );

  // Create new driving school (superadmin only)
  app.post(
    '/schools',
    authenticateRequest,
    requireRoles(['SUPERADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { name, contactEmail } = req.body as {
          name?: string;
          contactEmail?: string;
        };

        if (!name) {
          res.status(400).json({ error: 'name is required' });
          return;
        }

        const school = await createDrivingSchool({ name, contactEmail });

        // Also create school settings for the new school
        await upsertSchoolSettings(school.id, {});

        res.status(201).json(school);
      } catch (error) {
        next(error);
      }
    },
  );

  // Update driving school details (superadmin only)
  app.patch(
    '/schools/:schoolId',
    authenticateRequest,
    requireRoles(['SUPERADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = Number(req.params.schoolId);
        if (Number.isNaN(schoolId)) {
          res.status(400).json({ error: 'Invalid school id' });
          return;
        }

        const { name, contactEmail } = req.body as { name?: string; contactEmail?: string };
        if (name !== undefined && !name.trim()) {
          res.status(400).json({ error: 'School name cannot be empty' });
          return;
        }

        const school = await updateDrivingSchool(schoolId, { name, contactEmail });
        if (!school) {
          res.status(404).json({ error: 'School not found' });
          return;
        }

        res.json(school);
      } catch (error) {
        next(error);
      }
    },
  );

  // Update driving school status (suspend/activate/delete — superadmin only)
  app.patch(
    '/schools/:schoolId/status',
    authenticateRequest,
    requireRoles(['SUPERADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = Number(req.params.schoolId);
        if (Number.isNaN(schoolId)) {
          res.status(400).json({ error: 'Invalid school id' });
          return;
        }

        const { status } = req.body as { status?: string };
        if (!status || !['active', 'suspended', 'deleted'].includes(status)) {
          res.status(400).json({ error: 'status must be one of: active, suspended, deleted' });
          return;
        }

        const school = await updateDrivingSchoolStatus(schoolId, status as 'active' | 'suspended' | 'deleted');
        if (!school) {
          res.status(404).json({ error: 'School not found' });
          return;
        }

        res.json(school);
      } catch (error) {
        next(error);
      }
    },
  );

  // List users filtered by role (superadmin only)
  app.get(
    '/users',
    authenticateRequest,
    requireRoles(['SUPERADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const role = req.query.role as string | undefined;
        if (!role) {
          res.status(400).json({ error: 'role query parameter is required' });
          return;
        }

        const users = await listUsersByRole(role);
        res.json(users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          drivingSchoolId: u.drivingSchoolId,
          fullName: null,
        })));
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/schools/:schoolId/invitations',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const requestedSchoolId = Number(req.params.schoolId);
        if (Number.isNaN(requestedSchoolId)) {
          res.status(400).json({ error: 'Invalid school id' });
          return;
        }

        const tenantSchoolId = enforceTenantScope(req, res);
        if (tenantSchoolId === null && req.user?.role !== 'SUPERADMIN') {
          return;
        }

        if (tenantSchoolId && tenantSchoolId !== requestedSchoolId) {
          res.status(403).json({ error: 'Cross-tenant invitation not allowed' });
          return;
        }

        const school = await getDrivingSchoolById(requestedSchoolId);
        if (!school) {
          res.status(404).json({ error: 'Driving school not found' });
          return;
        }

        const { email, role, expiresInDays, fullName, allowedHours, maxLessonsPerDay } = req.body as {
          email?: string;
          role?: string;
          expiresInDays?: number;
          fullName?: string;
          allowedHours?: number;
          maxLessonsPerDay?: number;
        };

        if (!email || !role) {
          res.status(400).json({ error: 'email and role are required' });
          return;
        }

        const roleValue = role as UserRole;
        const allowedInvitationRoles: UserRole[] = ['SCHOOL_ADMIN', 'DRIVER', 'STUDENT'];
        if (!allowedInvitationRoles.includes(roleValue)) {
          res.status(400).json({ error: 'Unsupported role for invitation' });
          return;
        }

        const expiryDays = expiresInDays && expiresInDays > 0 ? expiresInDays : 7;
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

        const invitation = await upsertInvitation({
          drivingSchoolId: requestedSchoolId,
          email,
          role: roleValue,
          token,
          expiresAt,
          fullName,
          allowedHours,
          maxLessonsPerDay,
        });

        // Send invitation email (don't fail if email fails)
        try {
          await sendInvitationEmail({
            to: email,
            inviteeName: fullName || '',
            role: roleValue,
            schoolName: school.name,
            invitationToken: token,
          });
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
          // Continue - invitation is created, just email failed
        }

        res.status(201).json({ invitation });
      } catch (error) {
        next(error);
      }
    },
  );

  // Phase 3: Get all driver holidays for a school (Admin view)
  app.get(
    '/schools/:schoolId/drivers/holidays',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const holidays = await getDriverHolidaysForSchool(schoolId);
        res.json(holidays);
      } catch (error) {
        next(error);
      }
    },
  );

  // Phase 3: Get pending (unaccepted) invitations for a school
  app.get(
    '/schools/:schoolId/invitations/pending',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const invitations = await getPendingInvitations(schoolId);
        res.json(invitations);
      } catch (error) {
        next(error);
      }
    },
  );

  // Phase 3: Resend an invitation (regenerate token)
  app.post(
    '/schools/:schoolId/invitations/:invitationId/resend',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const invitationId = Number(req.params.invitationId);
        if (Number.isNaN(invitationId)) {
          res.status(400).json({ error: 'Invalid invitation id' });
          return;
        }

        const existing = await getInvitationById(invitationId, schoolId);
        if (!existing) {
          res.status(404).json({ error: 'Invitation not found' });
          return;
        }

        if (existing.acceptedAt) {
          res.status(400).json({ error: 'Invitation already accepted' });
          return;
        }

        const newToken = crypto.randomBytes(32).toString('hex');
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const updated = await resendInvitation(invitationId, schoolId, newToken, newExpiresAt);
        if (!updated) {
          res.status(400).json({ error: 'Unable to resend invitation' });
          return;
        }

        // Send invitation email
        const school = await getDrivingSchoolById(schoolId);
        if (school) {
          try {
            await sendInvitationEmail({
              to: updated.email,
              inviteeName: updated.fullName || '',
              role: updated.role,
              schoolName: school.name,
              invitationToken: newToken,
            });
          } catch (emailError) {
            console.error('Failed to send resend invitation email:', emailError);
            // Continue - invitation is updated, just email failed
          }
        }

        res.json({ invitation: updated });
      } catch (error) {
        next(error);
      }
    },
  );

  // Phase 3: Delete/Cancel an invitation
  app.delete(
    '/schools/:schoolId/invitations/:invitationId',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const invitationId = Number(req.params.invitationId);
        if (Number.isNaN(invitationId)) {
          res.status(400).json({ error: 'Invalid invitation id' });
          return;
        }

        const deleted = await deleteInvitation(invitationId, schoolId);
        if (!deleted) {
          res.status(404).json({ error: 'Invitation not found or already accepted' });
          return;
        }

        res.json({ message: 'Invitation cancelled' });
      } catch (error) {
        next(error);
      }
    },
  );

  // Validate invitation token (for registration page)
  app.get(
    '/invitations/validate',
    async (req, res, next) => {
      try {
        const token = req.query.token as string | undefined;
        if (!token) {
          res.status(400).json({ error: 'token is required' });
          return;
        }

        const invitation = await findInvitationByToken(token);
        if (!invitation) {
          res.status(404).json({ error: 'Invitation not found' });
          return;
        }

        if (invitation.acceptedAt) {
          res.status(400).json({ error: 'Invitation has already been accepted' });
          return;
        }

        if (new Date(invitation.expiresAt) < new Date()) {
          res.status(400).json({ error: 'Invitation has expired' });
          return;
        }

        const school = await getDrivingSchoolById(invitation.drivingSchoolId);

        res.json({
          email: invitation.email,
          role: invitation.role,
          schoolName: school?.name ?? 'Unknown School',
          fullName: invitation.fullName ?? null,
          expiresAt: invitation.expiresAt,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/invitations/accept',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const { token, password, fullName, phone, isMinor, guardianPhone, guardianEmail } = req.body as {
          token?: string;
          password?: string;
          fullName?: string;
          phone?: string;
          isMinor?: boolean;
          guardianPhone?: string;
          guardianEmail?: string;
        };

        if (!token) {
          res.status(400).json({ error: 'token is required' });
          return;
        }

        const invitation = await findInvitationByToken(token);
        if (!invitation) {
          res.status(404).json({ error: 'Invitation not found' });
          return;
        }

        if (invitation.acceptedAt) {
          res.status(400).json({ error: 'Invitation already accepted' });
          return;
        }

        if (invitation.expiresAt.getTime() < Date.now()) {
          res.status(400).json({ error: 'Invitation expired' });
          return;
        }

        let user;

        if (password) {
          // Password flow
          const passwordHash = await hashPassword(password);
          user = await createUserWithPassword({
            drivingSchoolId: invitation.drivingSchoolId,
            email: invitation.email,
            passwordHash,
            role: invitation.role,
          });
        } else {
          // Identity flow (Google etc)
          const authHeader = req.get('authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing Bearer token or password' });
            return;
          }
          const jwtToken = authHeader.replace('Bearer ', '').trim();
          const verification = await verifyJwtFromRequest(req, jwtToken);

          const identitySubject = verification.sub;
          if (!identitySubject) {
            res.status(400).json({ error: 'Token missing subject' });
            return;
          }

          user = await createUserWithIdentity({
            drivingSchoolId: invitation.drivingSchoolId,
            email: verification.email ?? invitation.email,
            identityProvider: verification.provider ?? process.env.AUTH_PROVIDER ?? 'google',
            identitySubject,
            role: invitation.role,
          });
        }

        // Create student profile if role is STUDENT
        if (invitation.role === 'STUDENT' && user) {
          await createStudentProfile({
            userId: user.id,
            drivingSchoolId: invitation.drivingSchoolId,
            fullName: fullName || invitation.fullName || invitation.email.split('@')[0],
            phone: phone,
            isMinor: isMinor ?? false,
            guardianPhone: isMinor ? guardianPhone : undefined,
            guardianEmail: isMinor ? guardianEmail : undefined,
            allowedHours: invitation.allowedHours ?? undefined,
            maxLessonsPerDay: invitation.maxLessonsPerDay ?? undefined,
          });
        }

        // Create driver profile if role is DRIVER
        if (invitation.role === 'DRIVER' && user) {
          await createDriverProfile({
            userId: user.id,
            drivingSchoolId: invitation.drivingSchoolId,
            fullName: fullName || invitation.fullName || invitation.email.split('@')[0],
          });
        }

        // Activate school if role is SCHOOL_ADMIN
        if (invitation.role === 'SCHOOL_ADMIN') {
          try {
            await activateDrivingSchool(invitation.drivingSchoolId);
          } catch (activationError) {
            console.error('Failed to activate school:', activationError);
            // Don't fail the registration if school activation fails
          }
        }

        const updatedInvitation = await markInvitationAccepted(invitation.id);

        res.json({ user, invitation: updatedInvitation });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/schools/:schoolId/admins/initial',
    authenticateRequest,
    requireRoles(['SUPERADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = Number(req.params.schoolId);
        if (Number.isNaN(schoolId)) {
          res.status(400).json({ error: 'Invalid school id' });
          return;
        }

        const school = await getDrivingSchoolById(schoolId);
        if (!school) {
          res.status(404).json({ error: 'Driving school not found' });
          return;
        }

        const { email, identitySubject, identityProvider } = req.body as {
          email?: string;
          identitySubject?: string;
          identityProvider?: string;
        };

        if (!email || !identitySubject) {
          res.status(400).json({ error: 'email and identitySubject are required' });
          return;
        }

        const adminCount = await countAdminsForSchool(schoolId);
        if (adminCount > 0) {
          res.status(400).json({ error: 'School already has an admin' });
          return;
        }

        const user = await createUserWithIdentity({
          drivingSchoolId: schoolId,
          email,
          identityProvider: identityProvider ?? process.env.AUTH_PROVIDER ?? 'google',
          identitySubject,
          role: 'SCHOOL_ADMIN',
        });

        res.status(201).json({ user });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/schools/:schoolId/drivers',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        if (!req.user) return;
        if (req.user.role === 'DRIVER') {
          const driver = await getDriverProfileByUserId(req.user.id, schoolId);
          if (!driver) {
            res.status(404).json({ error: 'Driver profile not found' });
            return;
          }
          res.json([driver]);
          return;
        }

        const drivers = await listDriverProfiles(schoolId);
        res.json(drivers);
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/schools/:schoolId/drivers',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const { userId, fullName, phone, workDayStart, workDayEnd, notes } = req.body as {
          userId?: number;
          fullName?: string;
          phone?: string;
          workDayStart?: string;
          workDayEnd?: string;
          notes?: string;
        };

        if (!userId || !fullName) {
          res.status(400).json({ error: 'userId and fullName are required' });
          return;
        }

        const driver = await createDriverProfile({
          userId,
          drivingSchoolId: schoolId,
          fullName,
          phone,
          workDayStart,
          workDayEnd,
          notes,
        });

        res.status(201).json(driver);
      } catch (error) {
        next(error);
      }
    },
  );

  app.patch(
    '/schools/:schoolId/drivers/:driverId',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const driverId = Number(req.params.driverId);
        if (Number.isNaN(driverId)) {
          res.status(400).json({ error: 'Invalid driver id' });
          return;
        }

        const existing = await getDriverProfileById(driverId, schoolId);
        if (!existing) {
          res.status(404).json({ error: 'Driver profile not found' });
          return;
        }

        if (req.user?.role === 'DRIVER' && req.user.id !== existing.userId) {
          res.status(403).json({ error: 'Drivers may only update their own profile' });
          return;
        }

        const allowedFields = ['fullName', 'phone', 'workDayStart', 'workDayEnd', 'notes', 'active',
          'serviceCenterLocation', 'serviceRadiusKm', 'lessonDurationMinutes', 'bufferMinutesBetweenLessons',
          'maxSegmentTravelTimeMin', 'maxSegmentTravelDistanceKm',
          'dailyMaxTravelTimeMin', 'dailyMaxTravelDistanceKm'];
        const updated = await updateDriverProfile(driverId, schoolId, pick(req.body, allowedFields));
        res.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/schools/:schoolId/students',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        if (!req.user) return;
        if (req.user.role === 'STUDENT') {
          const student = await getStudentProfileByUserId(req.user.id, schoolId);
          if (!student) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
          }
          res.json([student]);
          return;
        }

        const students = await listStudentProfiles(schoolId);
        res.json(students);
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/schools/:schoolId/students',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const studentFields = ['userId', 'fullName', 'dateOfBirth', 'phone', 'email', 'licenceNumber', 'licenceExpiryDate', 'licenceProvinceOrState', 'licenceImageUrl', 'licenceStatus', 'isMinor', 'guardianPhone', 'guardianEmail', 'allowedHours', 'maxLessonsPerDay'];
        const body = pick(req.body, studentFields) as Partial<CreateStudentProfileInput>;
        if (!body.userId || !body.fullName) {
          res.status(400).json({ error: 'userId and fullName are required' });
          return;
        }

        const student = await createStudentProfile({
          ...body,
          userId: body.userId,
          drivingSchoolId: schoolId,
          fullName: body.fullName,
        });

        res.status(201).json(student);
      } catch (error) {
        next(error);
      }
    },
  );

  app.patch(
    '/schools/:schoolId/students/:studentId',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const studentId = Number(req.params.studentId);
        if (Number.isNaN(studentId)) {
          res.status(400).json({ error: 'Invalid student id' });
          return;
        }

        const existing = await getStudentProfileById(studentId, schoolId);
        if (!existing) {
          res.status(404).json({ error: 'Student profile not found' });
          return;
        }

        if (req.user?.role === 'STUDENT' && req.user.id !== existing.userId) {
          res.status(403).json({ error: 'Students may only update their own profile' });
          return;
        }

        // Students cannot change their own licenceStatus - only admins/drivers can approve
        const studentUpdateFields = ['fullName', 'dateOfBirth', 'phone', 'email', 'licenceNumber',
          'licenceExpiryDate', 'licenceProvinceOrState', 'licenceImageUrl', 'licenceStatus',
          'licenceRejectionNote', 'allowedHours', 'maxLessonsPerDay', 'isMinor', 'guardianPhone', 'guardianEmail', 'active'];
        const body = pick(req.body, studentUpdateFields) as Record<string, unknown>;
        if (req.user?.role === 'STUDENT' && body.licenceStatus !== undefined) {
          res.status(403).json({ error: 'Students cannot change their licence status. Please wait for admin or instructor approval.' });
          return;
        }

        // If student updates licence info, reset status to pending_review (require re-approval)
        const licenceFields = ['licenceNumber', 'licenceImageUrl', 'licenceExpiryDate', 'licenceProvinceOrState'];
        const isLicenceUpdate = req.user?.role === 'STUDENT' && licenceFields.some((field) => body[field] !== undefined);
        const updateData = { ...body };
        if (isLicenceUpdate && existing.licenceStatus === 'approved') {
          updateData.licenceStatus = 'pending_review';
        }

        const updated = await updateStudentProfile(studentId, schoolId, updateData);
        res.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  // Get student usage statistics (used hours, daily bookings)
  app.get(
    '/schools/:schoolId/students/:studentId/usage',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const studentId = Number(req.params.studentId);
        if (Number.isNaN(studentId)) {
          res.status(400).json({ error: 'Invalid student id' });
          return;
        }

        const student = await getStudentProfileById(studentId, schoolId);
        if (!student) {
          res.status(404).json({ error: 'Student profile not found' });
          return;
        }

        if (req.user?.role === 'STUDENT' && req.user.id !== student.userId) {
          res.status(403).json({ error: 'Students may only view their own usage' });
          return;
        }

        const usedHours = await getTotalBookedHoursForStudent(schoolId, studentId);
        const todayBookings = await countScheduledBookingsForStudentOnDate(schoolId, studentId, new Date());

        res.json({
          usedHours,
          allowedHours: student.allowedHours,
          todayBookings,
          maxLessonsPerDay: student.maxLessonsPerDay,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Batch endpoint: fetch addresses for multiple students in one request
  app.get(
    '/schools/:schoolId/addresses/batch',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const studentIdsParam = req.query.studentIds as string | undefined;
        if (!studentIdsParam) {
          res.status(400).json({ error: 'studentIds query parameter is required' });
          return;
        }

        const studentIds = studentIdsParam.split(',').map(Number).filter(n => !Number.isNaN(n));
        if (studentIds.length === 0) {
          res.json([]);
          return;
        }

        const addresses = await listAddressesForStudents(studentIds, schoolId);
        res.json(addresses);
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/schools/:schoolId/students/:studentId/addresses',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const studentId = Number(req.params.studentId);
        if (Number.isNaN(studentId)) {
          res.status(400).json({ error: 'Invalid student id' });
          return;
        }

        if (req.user?.role === 'STUDENT') {
          const student = await getStudentProfileByUserId(req.user.id, schoolId);
          if (!student || student.id !== studentId) {
            res.status(403).json({ error: 'Students may only view their own addresses' });
            return;
          }
        }

        const addresses = await listAddressesForStudent(studentId, schoolId);
        res.json(addresses);
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/schools/:schoolId/students/:studentId/addresses',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const studentId = Number(req.params.studentId);
        if (Number.isNaN(studentId)) {
          res.status(400).json({ error: 'Invalid student id' });
          return;
        }

        if (req.user?.role === 'STUDENT') {
          const student = await getStudentProfileByUserId(req.user.id, schoolId);
          if (!student || student.id !== studentId) {
            res.status(403).json({ error: 'Students may only manage their own addresses' });
            return;
          }
        }

        const addrCreateFields = ['label', 'line1', 'line2', 'city', 'provinceOrState', 'postalCode', 'country', 'latitude', 'longitude', 'isDefaultPickup', 'isDefaultDropoff'];
        const addrBody = pick(req.body, addrCreateFields);
        const line1 = addrBody.line1 as string | undefined;
        if (!line1) {
          res.status(400).json({ error: 'line1 is required' });
          return;
        }

        const address = await createAddress({
          ...addrBody,
          drivingSchoolId: schoolId,
          studentId,
          line1,
        });

        res.status(201).json(address);
      } catch (error) {
        next(error);
      }
    },
  );

  app.patch(
    '/schools/:schoolId/addresses/:addressId',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const addressId = Number(req.params.addressId);
        if (Number.isNaN(addressId)) {
          res.status(400).json({ error: 'Invalid address id' });
          return;
        }

        const existing = await getAddressById(addressId, schoolId);
        if (!existing) {
          res.status(404).json({ error: 'Address not found' });
          return;
        }

        if (req.user?.role === 'STUDENT') {
          const student = await getStudentProfileByUserId(req.user.id, schoolId);
          if (!student || student.id !== existing.studentId) {
            res.status(403).json({ error: 'Students may only update their own addresses' });
            return;
          }
        }

        const addressFields = ['label', 'line1', 'line2', 'city', 'provinceOrState', 'postalCode',
          'country', 'latitude', 'longitude', 'isDefaultPickup', 'isDefaultDropoff'];
        const updated = await updateAddress(addressId, schoolId, pick(req.body, addressFields));
        res.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/schools/:schoolId/drivers/:driverId/availability',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const driverId = Number(req.params.driverId);
        if (Number.isNaN(driverId)) {
          res.status(400).json({ error: 'Invalid driver id' });
          return;
        }

        if (req.user?.role === 'DRIVER') {
          const driver = await getDriverProfileByUserId(req.user.id, schoolId);
          if (!driver || driver.id !== driverId) {
            res.status(403).json({ error: 'Drivers may only view their own availability' });
            return;
          }
        }

        const availability = await listAvailability(driverId, schoolId);
        res.json(availability);
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/schools/:schoolId/drivers/:driverId/availability',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const driverId = Number(req.params.driverId);
        if (Number.isNaN(driverId)) {
          res.status(400).json({ error: 'Invalid driver id' });
          return;
        }

        if (req.user?.role === 'DRIVER') {
          const driver = await getDriverProfileByUserId(req.user.id, schoolId);
          if (!driver || driver.id !== driverId) {
            res.status(403).json({ error: 'Drivers may only manage their own availability' });
            return;
          }
        }

        const { date, startTime, endTime, type } = req.body as {
          date?: string;
          startTime?: string;
          endTime?: string;
          type?: string;
        };

        if (!date || !startTime || !endTime) {
          res.status(400).json({ error: 'date, startTime, and endTime are required' });
          return;
        }

        // Prevent conflicts between off-days and availability
        const existingAvailability = await listAvailability(driverId, schoolId);
        if (type === 'override_closed') {
          const hasWorkingHours = existingAvailability.some(
            a => a.date.toISOString().slice(0, 10) === date && a.type === 'working_hours'
          );
          if (hasWorkingHours) {
            res.status(409).json({ error: 'Cannot block a day with published availability. Delete the availability first.' });
            return;
          }
        }
        if (type === 'working_hours') {
          const hasClosed = existingAvailability.some(
            a => a.date.toISOString().slice(0, 10) === date && a.type === 'override_closed'
          );
          if (hasClosed) {
            res.status(409).json({ error: 'Cannot add availability on a blocked day. Remove the time-off first.' });
            return;
          }
        }

        const availFields = ['date', 'startTime', 'endTime', 'type', 'notes'];
        const record = await createAvailability(driverId, schoolId, pick(req.body, availFields) as { date: string; startTime: string; endTime: string; type?: string; notes?: string });
        res.status(201).json(record);
      } catch (error) {
        next(error);
      }
    },
  );

  app.delete(
    '/schools/:schoolId/drivers/:driverId/availability/:availabilityId',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const driverId = Number(req.params.driverId);
        const availabilityId = Number(req.params.availabilityId);
        if (Number.isNaN(driverId) || Number.isNaN(availabilityId)) {
          res.status(400).json({ error: 'Invalid driver or availability id' });
          return;
        }

        if (req.user?.role === 'DRIVER') {
          const driver = await getDriverProfileByUserId(req.user.id, schoolId);
          if (!driver || driver.id !== driverId) {
            res.status(403).json({ error: 'Drivers may only manage their own availability' });
            return;
          }
        }

        const deleted = await deleteAvailability(availabilityId, driverId, schoolId);
        if (!deleted) {
          res.status(404).json({ error: 'Availability record not found' });
          return;
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/schools/:schoolId/drivers/:driverId/available-slots',
    slotQueryLimiter,
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const driverId = Number(req.params.driverId);
        if (Number.isNaN(driverId)) {
          res.status(400).json({ error: 'Invalid driver id' });
          return;
        }

        const dateParam = req.query.date as string | undefined;
        const pickupAddressId = req.query.pickupAddressId ? Number(req.query.pickupAddressId) : undefined;
        const dropoffAddressId = req.query.dropoffAddressId ? Number(req.query.dropoffAddressId) : undefined;

        if (!dateParam || Number.isNaN(Date.parse(dateParam))) {
          res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
          return;
        }

        if (!pickupAddressId || !dropoffAddressId) {
          res.status(400).json({ error: 'pickupAddressId and dropoffAddressId are required' });
          return;
        }

        // Parse date as UTC to avoid timezone issues
        const date = new Date(dateParam + 'T00:00:00Z');
        const driver = await getDriverProfileById(driverId, schoolId);
        if (!driver || !driver.active) {
          res.status(404).json({ error: 'Active driver not found for this school' });
          return;
        }

        let studentId: number | undefined;
        if (req.user?.role === 'STUDENT') {
          const student = await getStudentProfileByUserId(req.user.id, schoolId);
          if (!student || !student.active) {
            res.status(403).json({ error: 'Student profile required' });
            return;
          }
          if (student.licenceStatus !== 'approved') {
            res.status(403).json({ error: 'Student licence must be approved' });
            return;
          }
          studentId = student.id;
        }

        const settings = await getSchoolSettings(schoolId);
        const driverAvailabilities = await listAvailability(driver.id, schoolId);

        // Check if driver has a holiday/time off on this date
        const hasHolidayOnDate = driverAvailabilities.some(
          (entry) => entry.date.toISOString().slice(0, 10) === dateParam && entry.type === 'override_closed'
        );
        if (hasHolidayOnDate) {
          res.json([]); // No slots available on driver's day off
          return;
        }

        const pickupAddress = await getAddressById(pickupAddressId, schoolId);
        const dropoffAddress = await getAddressById(dropoffAddressId, schoolId);

        if (!pickupAddress || !dropoffAddress) {
          res.status(404).json({ error: 'Pickup or dropoff address not found' });
          return;
        }

        if (studentId && pickupAddress.studentId && pickupAddress.studentId !== studentId) {
          res.status(403).json({ error: 'Pickup address is not associated to the student' });
          return;
        }

        if (studentId && dropoffAddress.studentId && dropoffAddress.studentId !== studentId) {
          res.status(403).json({ error: 'Dropoff address is not associated to the student' });
          return;
        }

        const pickupLocation = addressToLocation(pickupAddress);
        const dropoffLocation = addressToLocation(dropoffAddress);
        if (!pickupLocation || !dropoffLocation) {
          res.status(400).json({ error: 'Pickup and dropoff addresses require coordinates' });
          return;
        }

        if (!driver.serviceCenterLocation) {
          res.status(400).json({ error: 'Driver is missing a service center location' });
          return;
        }

        const serviceRadius =
          coerceNumber(driver.serviceRadiusKm) ?? coerceNumber(settings?.defaultServiceRadiusKm) ?? Infinity;
        const radiusToPickup = travelCalculator.distanceBetween(
          driver.serviceCenterLocation as Location,
          pickupLocation,
        );
        const radiusToDropoff = travelCalculator.distanceBetween(
          driver.serviceCenterLocation as Location,
          dropoffLocation,
        );

        if (radiusToPickup > serviceRadius || radiusToDropoff > serviceRadius) {
          res.json([]);
          return;
        }

        const driverBookings = await buildDriverDayBookings(schoolId, driver.id, date);

        if (
          settings?.dailyBookingCapPerDriver !== null &&
          settings?.dailyBookingCapPerDriver !== undefined &&
          driverBookings.length >= settings.dailyBookingCapPerDriver
        ) {
          res.json([]);
          return;
        }

        const availabilityRequest: AvailabilityRequest = {
          date,
          driverProfile: driver,
          bookings: driverBookings,
          pickupLocation,
          dropoffLocation,
          schoolSettings: settings,
          availabilities: driverAvailabilities.filter((entry) => entry.date.toISOString().slice(0, 10) === dateParam),
        };

        // Apply effective lead time = max(leadTime, cancellationCutoff)
        const effectiveLeadTime = Math.max(
          settings?.minBookingLeadTimeHours ?? 0,
          settings?.cancellationCutoffHours ?? 0,
        );
        const slots = (await computeAvailableSlots(availabilityRequest, travelCalculator)).filter((slot) => {
          if (effectiveLeadTime <= 0) return true;
          const cutoff = Date.now() + effectiveLeadTime * 60 * 60 * 1000;
          return slot.getTime() >= cutoff;
        });

        res.json(slots.map((slot) => slot.toISOString()));
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/schools/:schoolId/bookings',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const statusFilter = req.query.status as string | undefined;
        const filters: { studentId?: number; driverId?: number; status?: string } = {};
        if (statusFilter) {
          filters.status = statusFilter;
        }
        if (req.user?.role === 'DRIVER') {
          const driver = await getDriverProfileByUserId(req.user.id, schoolId);
          if (!driver) {
            res.status(403).json({ error: 'Driver profile required' });
            return;
          }
          filters.driverId = driver.id;
        }

        if (req.user?.role === 'STUDENT') {
          const student = await getStudentProfileByUserId(req.user.id, schoolId);
          if (!student) {
            res.status(403).json({ error: 'Student profile required' });
            return;
          }
          filters.studentId = student.id;
        }

        const bookings = await listBookings(schoolId, filters);
        res.json(bookings);
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/schools/:schoolId/bookings',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const body = req.body as {
          studentId?: number;
          driverId?: number;
          startTime?: string;
          endTime?: string;
          pickupAddressId?: number;
          dropoffAddressId?: number;
        };

        if (!body.driverId) {
          res.status(400).json({ error: 'driverId is required' });
          return;
        }

        const settings = await getSchoolSettings(schoolId);
        let studentId = body.studentId;
        if (req.user?.role === 'STUDENT') {
          const student = await getStudentProfileByUserId(req.user.id, schoolId);
          if (!student) {
            res.status(403).json({ error: 'Student profile required' });
            return;
          }
          // Note: allowStudentToPickDriver is a UI-level preference only.
          // The driverId is always required for slot-based booking to work,
          // so we don't reject bookings with a driverId here.
          studentId = student.id;
        }

        if (!studentId) {
          res.status(400).json({ error: 'studentId is required' });
          return;
        }

        const driver = await getDriverProfileById(body.driverId, schoolId);
        const student = await getStudentProfileById(studentId, schoolId);
        if (!driver || !driver.active || !student || !student.active) {
          res.status(404).json({ error: 'Driver or student not found for this school' });
          return;
        }

        const driverAvailabilities = await listAvailability(driver.id, schoolId);

        if (student.licenceStatus !== 'approved') {
          res.status(403).json({ error: 'Student licence must be approved for bookings' });
          return;
        }

        // Check student's daily booking limit
        if (student.maxLessonsPerDay !== null && body.startTime) {
          const bookingDate = new Date(body.startTime);
          const dailyBookings = await countScheduledBookingsForStudentOnDate(schoolId, student.id, bookingDate);
          if (dailyBookings >= student.maxLessonsPerDay) {
            res.status(403).json({
              error: `Daily lesson limit reached. You can book maximum ${student.maxLessonsPerDay} lesson(s) per day.`,
              code: 'DAILY_LIMIT_EXCEEDED'
            });
            return;
          }
        }

        // Check student's total allowed hours
        if (student.allowedHours !== null) {
          const totalHours = await getTotalBookedHoursForStudent(schoolId, student.id);
          // Use actual lesson duration for new booking
          const lessonDuration = driver.lessonDurationMinutes ?? settings?.defaultLessonDurationMinutes ?? 60;
          const estimatedNewHours = lessonDuration / 60;

          if (totalHours + estimatedNewHours > student.allowedHours) {
            res.status(403).json({
              error: `Total hours limit reached. You have used ${totalHours.toFixed(1)} of ${student.allowedHours} allowed hours.`,
              code: 'HOURS_LIMIT_EXCEEDED'
            });
            return;
          }
        }

        if (!body.startTime) {
          res.status(400).json({ error: 'startTime is required' });
          return;
        }

        if (!body.pickupAddressId || !body.dropoffAddressId) {
          res.status(400).json({ error: 'pickupAddressId and dropoffAddressId are required' });
          return;
        }

        const pickupAddress = await getAddressById(body.pickupAddressId, schoolId);
        const dropoffAddress = await getAddressById(body.dropoffAddressId, schoolId);

        if (!pickupAddress || !dropoffAddress) {
          res.status(404).json({ error: 'Pickup or dropoff address not found for school' });
          return;
        }

        if (pickupAddress.studentId && pickupAddress.studentId !== student.id) {
          res.status(403).json({ error: 'Pickup address must belong to the student' });
          return;
        }

        if (dropoffAddress.studentId && dropoffAddress.studentId !== student.id) {
          res.status(403).json({ error: 'Dropoff address must belong to the student' });
          return;
        }

        const pickupLocation = addressToLocation(pickupAddress);
        const dropoffLocation = addressToLocation(dropoffAddress);
        if (!pickupLocation || !dropoffLocation) {
          res.status(400).json({ error: 'Pickup and dropoff addresses require coordinates' });
          return;
        }

        const startTime = new Date(body.startTime);
        if (Number.isNaN(startTime.getTime())) {
          res.status(400).json({ error: 'Invalid startTime' });
          return;
        }

        // Block booking in the past
        if (startTime.getTime() < Date.now()) {
          res.status(400).json({ error: 'Cannot book a lesson in the past' });
          return;
        }

        const lessonDuration = driver.lessonDurationMinutes ?? settings?.defaultLessonDurationMinutes ?? 60;

        if (!driver.serviceCenterLocation) {
          res.status(400).json({ error: 'Driver is missing a service center location' });
          return;
        }

        const serviceRadius =
          coerceNumber(driver.serviceRadiusKm) ?? coerceNumber(settings?.defaultServiceRadiusKm) ?? Infinity;
        const radiusToPickup = travelCalculator.distanceBetween(
          driver.serviceCenterLocation as Location,
          pickupLocation,
        );
        const radiusToDropoff = travelCalculator.distanceBetween(
          driver.serviceCenterLocation as Location,
          dropoffLocation,
        );

        if (radiusToPickup > serviceRadius || radiusToDropoff > serviceRadius) {
          res.status(400).json({ error: 'Pickup or dropoff is outside the driver service radius' });
          return;
        }

        // Enforce effective lead time = max(leadTime, cancellationCutoff)
        const effectiveLeadTimeHours = Math.max(
          settings?.minBookingLeadTimeHours ?? 0,
          settings?.cancellationCutoffHours ?? 0,
        );
        if (effectiveLeadTimeHours > 0) {
          const cutoff = Date.now() + effectiveLeadTimeHours * 60 * 60 * 1000;
          if (startTime.getTime() < cutoff) {
            res.status(400).json({ error: `Requested slot violates minimum lead time / cancellation policy (${effectiveLeadTimeHours}h)` });
            return;
          }
        }

        const driverBookings = await buildDriverDayBookings(schoolId, driver.id, startTime);

        if (
          settings?.dailyBookingCapPerDriver !== null &&
          settings?.dailyBookingCapPerDriver !== undefined &&
          driverBookings.length >= settings.dailyBookingCapPerDriver
        ) {
          res.status(409).json({ error: 'Driver daily booking cap reached' });
          return;
        }
        const availabilityRequest: AvailabilityRequest = {
          date: startTime,
          driverProfile: driver,
          bookings: driverBookings,
          pickupLocation,
          dropoffLocation,
          schoolSettings: settings,
          availabilities: driverAvailabilities.filter((entry) => entry.date.toDateString() === startTime.toDateString()),
        };

        let availableSlots = await computeAvailableSlots(availabilityRequest, travelCalculator);

        const effectiveLeadTimeBooking = Math.max(
          settings?.minBookingLeadTimeHours ?? 0,
          settings?.cancellationCutoffHours ?? 0,
        );
        if (effectiveLeadTimeBooking > 0) {
          const cutoff = Date.now() + effectiveLeadTimeBooking * 60 * 60 * 1000;
          availableSlots = availableSlots.filter((slot) => slot.getTime() >= cutoff);
        }
        const normalizedStart = new Date(startTime);
        normalizedStart.setSeconds(0, 0);
        const endTime = new Date(normalizedStart.getTime() + lessonDuration * 60 * 1000);
        const match = availableSlots.find((slot) => slot.getTime() === normalizedStart.getTime());
        if (!match) {
          res.status(409).json({ error: 'Requested slot is not available for this driver' });
          return;
        }

        let booking;
        try {
          booking = await createBookingAtomic({
            drivingSchoolId: schoolId,
            studentId,
            driverId: driver.id,
            pickupAddressId: body.pickupAddressId,
            dropoffAddressId: body.dropoffAddressId,
            startTime: normalizedStart.toISOString(),
            endTime: endTime.toISOString(),
            notes: req.body.notes ?? null,
          });
        } catch (err: unknown) {
          if (err instanceof Error && err.message === 'BOOKING_OVERLAP') {
            res.status(409).json({ error: 'This time slot was just booked by someone else. Please choose another slot.' });
            return;
          }
          throw err;
        }

        // Send confirmation emails (non-blocking)
        (async () => {
          try {
            const school = await getDrivingSchoolById(schoolId);
            const studentUser = await getUserById(student.userId);
            const driverUser = await getUserById(driver.userId);

            const lessonDate = normalizedStart.toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const lessonTime = normalizedStart.toLocaleTimeString('en-US', {
              hour: '2-digit', minute: '2-digit'
            });

            const pickupAddr = `${pickupAddress.line1}, ${pickupAddress.city}`;
            const dropoffAddr = `${dropoffAddress.line1}, ${dropoffAddress.city}`;

            if (studentUser?.email) {
              await sendBookingConfirmationEmail({
                to: studentUser.email,
                studentName: student.fullName,
                driverName: driver.fullName,
                schoolName: school?.name || 'Driving School',
                lessonDate,
                lessonTime,
                pickupAddress: pickupAddr,
                dropoffAddress: dropoffAddr,
              });
            }

            if (driverUser?.email) {
              await sendDriverBookingNotification(
                driverUser.email,
                driver.fullName,
                student.fullName,
                lessonDate,
                lessonTime,
                pickupAddr,
                dropoffAddr,
                school?.name || 'Driving School',
              );
            }
          } catch (emailError) {
            console.error('Failed to send booking notification emails:', emailError);
          }
        })();

        res.status(201).json(booking);
      } catch (error) {
        next(error);
      }
    },
  );

  app.patch(
    '/schools/:schoolId/bookings/:bookingId',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const bookingId = Number(req.params.bookingId);
        if (Number.isNaN(bookingId)) {
          res.status(400).json({ error: 'Invalid booking id' });
          return;
        }

        const existing = await getBookingById(bookingId, schoolId);
        if (!existing) {
          res.status(404).json({ error: 'Booking not found' });
          return;
        }

        if (req.user?.role === 'DRIVER') {
          const driver = await getDriverProfileByUserId(req.user.id, schoolId);
          if (!driver || driver.id !== existing.driverId) {
            res.status(403).json({ error: 'Drivers may only update their own bookings' });
            return;
          }
        }

        if (req.user?.role === 'STUDENT') {
          const student = await getStudentProfileByUserId(req.user.id, schoolId);
          if (!student || student.id !== existing.studentId) {
            res.status(403).json({ error: 'Students may only update their own bookings' });
            return;
          }
        }

        const patchBody = req.body as { startTime?: string; endTime?: string; force?: boolean;[key: string]: unknown };

        if (patchBody.startTime) {
          const newStart = new Date(patchBody.startTime);
          if (newStart.getTime() < Date.now()) {
            res.status(400).json({ error: 'Cannot reschedule to a past time' });
            return;
          }

          const existingDuration = existing.endTime.getTime() - existing.startTime.getTime();
          const newEnd = patchBody.endTime ? new Date(patchBody.endTime) : new Date(newStart.getTime() + existingDuration);
          const driverId = patchBody.driverId ? Number(patchBody.driverId) : existing.driverId;

          // Validate slot feasibility using the same logic as booking creation
          const driver = await getDriverProfileById(driverId, schoolId);
          if (!driver) {
            res.status(404).json({ error: 'Driver not found' });
            return;
          }

          const settings = await getSchoolSettings(schoolId);
          const driverAvailabilities = await listAvailability(driverId, schoolId);

          // Build day bookings excluding the booking being rescheduled
          const dayBookings = (await buildDriverDayBookings(schoolId, driverId, newStart))
            .filter((b) => b.id !== bookingId);

          // Resolve pickup/dropoff locations from the existing booking
          const pickupAddress = existing.pickupAddressId ? await getAddressById(existing.pickupAddressId, schoolId) : null;
          const dropoffAddress = existing.dropoffAddressId ? await getAddressById(existing.dropoffAddressId, schoolId) : null;
          const pickupLocation = addressToLocation(pickupAddress);
          const dropoffLocation = addressToLocation(dropoffAddress);

          if (pickupLocation && dropoffLocation && driver.serviceCenterLocation) {
            const availabilityRequest: AvailabilityRequest = {
              date: newStart,
              driverProfile: driver,
              bookings: dayBookings,
              pickupLocation,
              dropoffLocation,
              schoolSettings: settings,
              availabilities: driverAvailabilities.filter(
                (entry) => entry.date.toISOString().slice(0, 10) === newStart.toISOString().slice(0, 10),
              ),
            };

            const availableSlots = await computeAvailableSlots(availabilityRequest, travelCalculator);
            const normalizedStart = new Date(newStart);
            normalizedStart.setSeconds(0, 0);
            const isValidSlot = availableSlots.some(
              (slot) => slot.getTime() === normalizedStart.getTime(),
            );

            if (!isValidSlot) {
              if (req.user?.role === 'STUDENT') {
                res.status(400).json({ error: 'Selected time is not available for this driver' });
                return;
              }
              if (!patchBody.force) {
                res.status(409).json({
                  error: 'The selected time falls outside the driver\'s computed available slots. This may cause logistical issues (travel time, buffer, or daily limits).',
                  code: 'REQUIRES_FORCE',
                  details: ['New time is outside computed available slots for this driver'],
                });
                return;
              }
            }
          }

          // Atomic reschedule: overlap check + update in one transaction
          try {
            const rescheduled = await rescheduleBookingAtomic(
              bookingId, schoolId, driverId,
              newStart.toISOString(), newEnd.toISOString(),
            );
            if (!rescheduled) {
              res.status(404).json({ error: 'Booking not found or not in scheduled status' });
              return;
            }

            // If there are other fields to update besides time, apply them
            const bookingExtraFields = ['notes', 'pickupAddressId', 'dropoffAddressId', 'driverId'];
            const extraUpdates = pick(patchBody, bookingExtraFields) as Record<string, unknown>;
            if (extraUpdates.driverId) extraUpdates.driverId = Number(extraUpdates.driverId);
            if (Object.keys(extraUpdates).length > 0) {
              const finalResult = await updateBooking(bookingId, schoolId, extraUpdates);
              res.json(finalResult);
            } else {
              res.json(rescheduled);
            }
          } catch (err) {
            if (err instanceof Error && err.message === 'BOOKING_OVERLAP') {
              res.status(409).json({ error: 'Rescheduled time conflicts with an existing booking' });
              return;
            }
            throw err;
          }
        } else {
          // Non-time update (notes, etc.)
          const bookingFields = ['notes', 'pickupAddressId', 'dropoffAddressId'];
          const updated = await updateBooking(bookingId, schoolId, pick(req.body, bookingFields));
          res.json(updated);
        }
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/schools/:schoolId/bookings/:bookingId/cancel',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const bookingId = Number(req.params.bookingId);
        if (Number.isNaN(bookingId)) {
          res.status(400).json({ error: 'Invalid booking id' });
          return;
        }

        const booking = await getBookingById(bookingId, schoolId);
        if (!booking) {
          res.status(404).json({ error: 'Booking not found' });
          return;
        }

        if (req.user?.role === 'DRIVER') {
          const driver = await getDriverProfileByUserId(req.user.id, schoolId);
          if (!driver || driver.id !== booking.driverId) {
            res.status(403).json({ error: 'Drivers may only cancel their own bookings' });
            return;
          }
        }

        if (req.user?.role === 'STUDENT') {
          const student = await getStudentProfileByUserId(req.user.id, schoolId);
          if (!student || student.id !== booking.studentId) {
            res.status(403).json({ error: 'Students may only cancel their own bookings' });
            return;
          }
        }

        const settings = await getSchoolSettings(schoolId);
        // Only enforce cutoff for future bookings (allow cancelling past bookings for cleanup)
        const bookingTime = booking.startTime.getTime();
        const now = Date.now();
        if (settings?.cancellationCutoffHours && bookingTime > now) {
          const cutoff = bookingTime - settings.cancellationCutoffHours * 60 * 60 * 1000;
          if (now > cutoff) {
            res.status(400).json({ error: 'Booking can no longer be cancelled per policy' });
            return;
          }
        }

        const reason = (req.body as { reasonCode?: string }).reasonCode ?? null;
        const status: 'cancelled_by_student' | 'cancelled_by_driver' | 'cancelled_by_school' =
          req.user?.role === 'DRIVER'
            ? 'cancelled_by_driver'
            : req.user?.role === 'STUDENT'
              ? 'cancelled_by_student'
              : 'cancelled_by_school';

        const cancelled = await cancelBooking(booking.id, schoolId, status, reason);

        // Send cancellation email (non-blocking)
        (async () => {
          try {
            const school = await getDrivingSchoolById(schoolId);
            const student = await getStudentProfileById(booking.studentId, schoolId);
            const studentUser = student ? await getUserById(student.userId) : null;

            const lessonDate = booking.startTime.toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const lessonTime = booking.startTime.toLocaleTimeString('en-US', {
              hour: '2-digit', minute: '2-digit'
            });

            // Resolve addresses for email (using ID from booking)
            let pickupAddr = booking.pickupAddressId?.toString() || 'N/A';
            let dropoffAddr = booking.dropoffAddressId?.toString() || 'N/A';

            try {
              if (booking.pickupAddressId) {
                const pAddr = await getAddressById(booking.pickupAddressId, schoolId);
                if (pAddr) pickupAddr = `${pAddr.line1}, ${pAddr.city}`;
              }
              if (booking.dropoffAddressId) {
                const dAddr = await getAddressById(booking.dropoffAddressId, schoolId);
                if (dAddr) dropoffAddr = `${dAddr.line1}, ${dAddr.city}`;
              }
            } catch (addrErr) {
              console.warn('Could not resolve addresses for cancellation email', addrErr);
            }

            if (studentUser?.email && student) {
              await sendBookingCancellationEmail({
                to: studentUser.email,
                studentName: student.fullName,
                schoolName: school?.name || 'Driving School',
                lessonDate,
                lessonTime,
                pickupAddress: pickupAddr,
                dropoffAddress: dropoffAddr,
              });
            }
          } catch (emailError) {
            console.error('Failed to send cancellation email:', emailError);
          }
        })();

        res.json(cancelled);
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/schools/:schoolId/bookings/:bookingId/complete',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const bookingId = Number(req.params.bookingId);
        if (Number.isNaN(bookingId)) {
          res.status(400).json({ error: 'Invalid booking id' });
          return;
        }

        const booking = await getBookingById(bookingId, schoolId);
        if (!booking) {
          res.status(404).json({ error: 'Booking not found' });
          return;
        }

        // Drivers can only complete their own bookings
        if (req.user?.role === 'DRIVER') {
          const driver = await getDriverProfileByUserId(req.user.id, schoolId);
          if (!driver || driver.id !== booking.driverId) {
            res.status(403).json({ error: 'Drivers may only complete their own bookings' });
            return;
          }
        }

        const completed = await completeBooking(booking.id, schoolId);
        if (!completed) {
          res.status(400).json({ error: 'Only scheduled bookings can be marked as completed' });
          return;
        }

        res.json(completed);
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/schools/:schoolId/settings',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const settings = await getSchoolSettings(schoolId);
        res.json(settings);
      } catch (error) {
        next(error);
      }
    },
  );

  app.put(
    '/schools/:schoolId/settings',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = await resolveSchoolContext(req, res);
        if (!schoolId) return;

        const settingsFields = ['minBookingLeadTimeHours', 'cancellationCutoffHours',
          'defaultLessonDurationMinutes', 'defaultBufferMinutesBetweenLessons',
          'defaultServiceRadiusKm', 'defaultMaxSegmentTravelTimeMin', 'defaultMaxSegmentTravelDistanceKm',
          'defaultDailyMaxTravelTimeMin', 'defaultDailyMaxTravelDistanceKm',
          'dailyBookingCapPerDriver', 'allowStudentToPickDriver', 'allowDriverSelfAvailabilityEdit'];
        const body = pick(req.body, settingsFields);
        const numericFields: Array<{ key: string; min: number; max: number }> = [
          { key: 'minBookingLeadTimeHours', min: 0, max: 720 },
          { key: 'cancellationCutoffHours', min: 0, max: 720 },
          { key: 'defaultLessonDurationMinutes', min: 15, max: 480 },
          { key: 'defaultBufferMinutesBetweenLessons', min: 0, max: 120 },
          { key: 'defaultServiceRadiusKm', min: 0, max: 500 },
          { key: 'defaultMaxSegmentTravelTimeMin', min: 0, max: 480 },
          { key: 'defaultMaxSegmentTravelDistanceKm', min: 0, max: 500 },
          { key: 'defaultDailyMaxTravelTimeMin', min: 0, max: 720 },
          { key: 'defaultDailyMaxTravelDistanceKm', min: 0, max: 1000 },
          { key: 'dailyBookingCapPerDriver', min: 1, max: 50 },
        ];
        for (const { key, min, max } of numericFields) {
          if (body[key] !== undefined && body[key] !== null) {
            const val = Number(body[key]);
            if (!Number.isFinite(val) || val < min || val > max) {
              res.status(400).json({ error: `${key} must be a number between ${min} and ${max}` });
              return;
            }
          }
        }

        const settings = await upsertSchoolSettings(schoolId, body);
        res.json(settings);
      } catch (error) {
        next(error);
      }
    },
  );

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled error', error);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
