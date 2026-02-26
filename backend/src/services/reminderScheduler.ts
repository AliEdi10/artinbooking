/**
 * Lesson Reminder Scheduler
 * 
 * Runs periodically to find upcoming bookings and send reminder emails
 * to both students and drivers approximately 24 hours before their lessons.
 */

import { getPool } from '../db';
import { mapBooking } from '../models';
import { getBookingsForReminder, markReminderSent } from '../repositories/bookings';
import { getStudentProfileById } from '../repositories/studentProfiles';
import { getDriverProfileById } from '../repositories/driverProfiles';
import { getDrivingSchoolById } from '../repositories/drivingSchools';
import { getAddressById } from '../repositories/studentAddresses';
import { getUserById } from '../repositories/users';
import { getEmailTemplate } from '../repositories/emailTemplates';
import {
    sendStudentLessonReminderEmail,
    sendDriverLessonReminderEmail,
} from './email';

// Scheduler interval: check every 15 minutes
const SCHEDULER_INTERVAL_MS = 15 * 60 * 1000;

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Format a Date object to a readable date string
 */
function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        timeZone: 'America/Halifax',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Format a Date object to a readable time string
 */
function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        timeZone: 'America/Halifax',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

/**
 * Build a readable address string from address components
 */
function formatAddress(address: { line1: string; line2?: string | null; city?: string | null }): string {
    const parts = [address.line1];
    if (address.line2) parts.push(address.line2);
    if (address.city) parts.push(address.city);
    return parts.join(', ');
}

/**
 * Process a single booking and send reminder emails
 */
async function processBookingReminder(bookingRow: Awaited<ReturnType<typeof getBookingsForReminder>>[0]): Promise<void> {
    const booking = mapBooking(bookingRow);

    console.log(`Processing reminder for booking ${booking.id} (lesson at ${booking.startTime})`);

    try {
        // Fetch related data
        const [student, driver, school] = await Promise.all([
            getStudentProfileById(booking.studentId, booking.drivingSchoolId),
            getDriverProfileById(booking.driverId, booking.drivingSchoolId),
            getDrivingSchoolById(booking.drivingSchoolId),
        ]);

        if (!student || !driver || !school) {
            console.warn(`Missing data for booking ${booking.id}: student=${!!student}, driver=${!!driver}, school=${!!school}`);
            return;
        }

        // Get pickup address
        let pickupAddress = 'Address not specified';
        if (booking.pickupAddressId) {
            const address = await getAddressById(booking.pickupAddressId, booking.drivingSchoolId);
            if (address) {
                pickupAddress = formatAddress(address);
            }
        }

        // Get user emails for student and driver
        const [studentUser, driverUser] = await Promise.all([
            getUserById(student.userId),
            getUserById(driver.userId),
        ]);

        const lessonDate = formatDate(booking.startTime);
        const lessonTime = formatTime(booking.startTime);

        // Load custom reminder template for this school (best-effort)
        const reminderTpl = await getEmailTemplate(booking.drivingSchoolId, 'lesson_reminder').catch(() => null);

        // Send reminder to student
        if (student.email || studentUser?.email) {
            await sendStudentLessonReminderEmail({
                to: student.email || studentUser!.email,
                recipientName: student.fullName,
                studentName: student.fullName,
                driverName: driver.fullName,
                schoolName: school.name,
                lessonDate,
                lessonTime,
                pickupAddress,
                customSubject: reminderTpl?.subject,
                customNote: reminderTpl?.customNote,
            });
            // CC guardian for minor students
            if (student.isMinor && student.guardianEmail) {
                await sendStudentLessonReminderEmail({
                    to: student.guardianEmail,
                    recipientName: 'Guardian',
                    studentName: student.fullName,
                    driverName: driver.fullName,
                    schoolName: school.name,
                    lessonDate,
                    lessonTime,
                    pickupAddress,
                    customSubject: reminderTpl?.subject,
                    customNote: reminderTpl?.customNote,
                });
            }
        } else {
            console.warn(`No email found for student ${student.id} (${student.fullName})`);
        }

        // Send reminder to driver
        if (driverUser?.email) {
            await sendDriverLessonReminderEmail({
                to: driverUser.email,
                recipientName: driver.fullName,
                studentName: student.fullName,
                driverName: driver.fullName,
                schoolName: school.name,
                lessonDate,
                lessonTime,
                pickupAddress,
            });
        } else {
            console.warn(`No email found for driver ${driver.id} (${driver.fullName})`);
        }

        // Mark reminder as sent
        await markReminderSent(booking.id);
        console.log(`✅ Reminder sent for booking ${booking.id}`);

    } catch (error) {
        console.error(`Failed to process reminder for booking ${booking.id}:`, error);
        // Don't mark as sent so it will be retried
    }
}

/**
 * Main scheduler job - finds bookings needing reminders and sends them
 */
export async function runReminderJob(): Promise<void> {
    if (isRunning) {
        console.log(`[${new Date().toISOString()}] Reminder job already running, skipping.`);
        return;
    }
    isRunning = true;
    console.log(`[${new Date().toISOString()}] Running lesson reminder job...`);

    try {
        const bookings = await getBookingsForReminder();

        if (bookings.length === 0) {
            console.log('No bookings need reminders at this time.');
            return;
        }

        console.log(`Found ${bookings.length} booking(s) needing reminders.`);

        // Process each booking sequentially to avoid overwhelming email service
        for (const booking of bookings) {
            await processBookingReminder(booking);
        }

        console.log('Reminder job completed.');
    } catch (error) {
        console.error('Reminder job failed:', error);
    } finally {
        isRunning = false;
    }
}

/**
 * Start the reminder scheduler
 * Runs immediately once, then every 15 minutes
 */
export function startReminderScheduler(): void {
    if (schedulerInterval) {
        console.warn('Reminder scheduler is already running');
        return;
    }

    console.log('🔔 Starting lesson reminder scheduler (runs every 15 minutes)');

    // Run immediately on startup
    runReminderJob().catch(console.error);

    // Then run every 15 minutes
    schedulerInterval = setInterval(() => {
        runReminderJob().catch(console.error);
    }, SCHEDULER_INTERVAL_MS);
}

/**
 * Stop the reminder scheduler
 */
export function stopReminderScheduler(): void {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('Reminder scheduler stopped');
    }
}
