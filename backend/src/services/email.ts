import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_NAME = process.env.APP_NAME || 'Artin Driving School';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://artinbooking.vercel.app';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SendInvitationEmailParams {
  to: string;
  inviteeName: string;
  role: string;
  schoolName: string;
  invitationToken: string;
}

export async function sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
  const { to, role, invitationToken } = params;
  const inviteeName = escapeHtml(params.inviteeName);
  const schoolName = escapeHtml(params.schoolName);

  const registrationUrl = `${FRONTEND_URL}/register?token=${encodeURIComponent(invitationToken)}`;

  const roleDisplay = role === 'STUDENT' ? 'student' : role === 'DRIVER' ? 'instructor' : 'team member';

  // Debug: Check if API key is set
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set! Email will not be sent.');
    return;
  }

  console.log(`Attempting to send invitation email to ${to}...`);

  try {
    // Add special note for students
    const studentNote = role === 'STUDENT'
      ? `<p style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; font-size: 14px;">
           <strong>📋 Important:</strong> Please ensure you have your valid driver's license ready for all in-car lessons.
         </p>`
      : '';

    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You're invited to join ${schoolName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Welcome to ${APP_NAME}!</h2>
          <p>Hi ${inviteeName || 'there'},</p>
          <p>You've been invited to join <strong>${schoolName}</strong> as a ${roleDisplay}.</p>
          ${studentNote}
          <p style="margin: 24px 0;">
            <a href="${registrationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Complete Your Registration
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${registrationUrl}">${registrationUrl}</a>
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
            This invitation will expire in 7 days.
          </p>
        </div>
      `,
    });
    console.log(`Invitation email sent to ${to}`, result);
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Reset your ${APP_NAME} password`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Password Reset Request</h2>
          <p>You requested to reset your password.</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });
    console.log(`Password reset email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

// Booking confirmation email types
export interface BookingEmailParams {
  to: string;
  studentName: string;
  driverName: string;
  schoolName: string;
  lessonDate: string; // Formatted date string
  lessonTime: string; // e.g., "10:00 AM"
  pickupAddress: string;
  dropoffAddress: string;
}

export async function sendBookingConfirmationEmail(params: BookingEmailParams): Promise<void> {
  const { to } = params;
  const studentName = escapeHtml(params.studentName);
  const driverName = escapeHtml(params.driverName);
  const schoolName = escapeHtml(params.schoolName);
  const lessonDate = escapeHtml(params.lessonDate);
  const lessonTime = escapeHtml(params.lessonTime);
  const pickupAddress = escapeHtml(params.pickupAddress);
  const dropoffAddress = escapeHtml(params.dropoffAddress);

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set! Booking confirmation email will not be sent.');
    return;
  }

  console.log(`Sending booking confirmation email to ${to}...`);

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `✅ Lesson Confirmed - ${lessonDate} at ${lessonTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">✅ Your Driving Lesson is Confirmed!</h2>
          <p>Hi ${studentName},</p>
          <p>Your driving lesson with <strong>${schoolName}</strong> has been booked!</p>
          
          <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #166534;">📅 Lesson Details</h3>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${lessonDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${lessonTime}</p>
            <p style="margin: 4px 0;"><strong>Instructor:</strong> ${driverName}</p>
            <p style="margin: 4px 0;"><strong>Pickup:</strong> ${pickupAddress}</p>
            <p style="margin: 4px 0;"><strong>Drop-off:</strong> ${dropoffAddress}</p>
          </div>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 8px 0; color: #dc2626;">⚠️ IMPORTANT - Please Read!</h3>
            <p style="margin: 0; font-weight: bold; color: #991b1b;">
              You MUST bring your PHYSICAL driver's license (learner's permit) to your lesson.
            </p>
            <p style="margin: 8px 0 0 0; color: #991b1b;">
              A digital copy, photo, or screenshot is <strong>NOT acceptable</strong>. 
              Without your physical license, your lesson will be cancelled and you may be charged.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Need to cancel or reschedule? Log in to your account at 
            <a href="${FRONTEND_URL}">${FRONTEND_URL}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
            See you on the road! 🚗<br>
            - ${schoolName}
          </p>
        </div>
      `,
    });
    console.log(`Booking confirmation email sent to ${to}`, result);
  } catch (error) {
    console.error('Failed to send booking confirmation email:', error);
    // Don't throw - email failure shouldn't block booking
  }
}

export async function sendBookingCancellationEmail(params: Omit<BookingEmailParams, 'driverName'>): Promise<void> {
  const { to } = params;
  const studentName = escapeHtml(params.studentName);
  const schoolName = escapeHtml(params.schoolName);
  const lessonDate = escapeHtml(params.lessonDate);
  const lessonTime = escapeHtml(params.lessonTime);
  const pickupAddress = escapeHtml(params.pickupAddress);
  const dropoffAddress = escapeHtml(params.dropoffAddress);

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set! Cancellation email will not be sent.');
    return;
  }

  console.log(`Sending booking cancellation email to ${to}...`);

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `❌ Lesson Cancelled - ${lessonDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">❌ Your Lesson Has Been Cancelled</h2>
          <p>Hi ${studentName},</p>
          <p>Your driving lesson has been cancelled.</p>
          
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #991b1b;">Cancelled Lesson</h3>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${lessonDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${lessonTime}</p>
            <p style="margin: 4px 0;"><strong>Pickup:</strong> ${pickupAddress}</p>
            <p style="margin: 4px 0;"><strong>Drop-off:</strong> ${dropoffAddress}</p>
          </div>
          
          <p>
            Want to book a new lesson? Log in to your account at 
            <a href="${FRONTEND_URL}" style="color: #2563eb;">${FRONTEND_URL}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
            - ${schoolName}
          </p>
        </div>
      `,
    });
    console.log(`Booking cancellation email sent to ${to}`, result);
  } catch (error) {
    console.error('Failed to send booking cancellation email:', error);
    // Don't throw - email failure shouldn't block cancellation
  }
}

export async function sendDriverCancellationNotification(
  to: string,
  rawDriverName: string,
  rawStudentName: string,
  rawLessonDate: string,
  rawLessonTime: string,
  rawPickupAddress: string,
  rawDropoffAddress: string,
  rawSchoolName: string,
): Promise<void> {
  const driverName = escapeHtml(rawDriverName);
  const studentName = escapeHtml(rawStudentName);
  const lessonDate = escapeHtml(rawLessonDate);
  const lessonTime = escapeHtml(rawLessonTime);
  const pickupAddress = escapeHtml(rawPickupAddress);
  const dropoffAddress = escapeHtml(rawDropoffAddress);
  const schoolName = escapeHtml(rawSchoolName);

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set! Driver cancellation notification will not be sent.');
    return;
  }

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `❌ Lesson Cancelled - ${lessonDate} at ${lessonTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">❌ Lesson Cancelled</h2>
          <p>Hi ${driverName},</p>
          <p>A lesson has been cancelled.</p>

          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Student:</strong> ${studentName}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${lessonDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${lessonTime}</p>
            <p style="margin: 4px 0;"><strong>Pickup:</strong> ${pickupAddress}</p>
            <p style="margin: 4px 0;"><strong>Drop-off:</strong> ${dropoffAddress}</p>
          </div>

          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
            - ${schoolName}
          </p>
        </div>
      `,
    });
    console.log(`Driver cancellation notification sent to ${to}`);
  } catch (error) {
    console.error('Failed to send driver cancellation notification:', error);
  }
}

export async function sendDriverBookingNotification(
  to: string,
  rawDriverName: string,
  rawStudentName: string,
  rawLessonDate: string,
  rawLessonTime: string,
  rawPickupAddress: string,
  rawDropoffAddress: string,
  rawSchoolName: string
): Promise<void> {
  const driverName = escapeHtml(rawDriverName);
  const studentName = escapeHtml(rawStudentName);
  const lessonDate = escapeHtml(rawLessonDate);
  const lessonTime = escapeHtml(rawLessonTime);
  const pickupAddress = escapeHtml(rawPickupAddress);
  const dropoffAddress = escapeHtml(rawDropoffAddress);
  const schoolName = escapeHtml(rawSchoolName);

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set! Driver notification will not be sent.');
    return;
  }

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `📅 New Lesson Booked - ${lessonDate} at ${lessonTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">📅 New Lesson Assignment</h2>
          <p>Hi ${driverName},</p>
          <p>A new lesson has been booked with you!</p>

          <div style="background-color: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Student:</strong> ${studentName}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${lessonDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${lessonTime}</p>
            <p style="margin: 4px 0;"><strong>Pickup:</strong> ${pickupAddress}</p>
            <p style="margin: 4px 0;"><strong>Drop-off:</strong> ${dropoffAddress}</p>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
            - ${schoolName}
          </p>
        </div>
      `,
    });
    console.log(`Driver notification email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send driver notification email:', error);
  }
}

export async function sendBookingRescheduleEmail(params: BookingEmailParams): Promise<void> {
  const { to } = params;
  const studentName = escapeHtml(params.studentName);
  const driverName = escapeHtml(params.driverName);
  const schoolName = escapeHtml(params.schoolName);
  const lessonDate = escapeHtml(params.lessonDate);
  const lessonTime = escapeHtml(params.lessonTime);
  const pickupAddress = escapeHtml(params.pickupAddress);
  const dropoffAddress = escapeHtml(params.dropoffAddress);

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set! Reschedule email will not be sent.');
    return;
  }

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `🔄 Lesson Rescheduled - ${lessonDate} at ${lessonTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">🔄 Your Lesson Has Been Rescheduled</h2>
          <p>Hi ${studentName},</p>
          <p>Your driving lesson with <strong>${schoolName}</strong> has been rescheduled to a new time.</p>

          <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #92400e;">📅 New Lesson Details</h3>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${lessonDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${lessonTime}</p>
            <p style="margin: 4px 0;"><strong>Instructor:</strong> ${driverName}</p>
            <p style="margin: 4px 0;"><strong>Pickup:</strong> ${pickupAddress}</p>
            <p style="margin: 4px 0;"><strong>Drop-off:</strong> ${dropoffAddress}</p>
          </div>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 8px 0; color: #dc2626;">⚠️ IMPORTANT - Please Read!</h3>
            <p style="margin: 0; font-weight: bold; color: #991b1b;">
              You MUST bring your PHYSICAL driver's license (learner's permit) to your lesson.
            </p>
            <p style="margin: 8px 0 0 0; color: #991b1b;">
              A digital copy, photo, or screenshot is <strong>NOT acceptable</strong>.
              Without your physical license, your lesson will be cancelled and you may be charged.
            </p>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Need to cancel? Log in to your account at
            <a href="${FRONTEND_URL}">${FRONTEND_URL}</a>
          </p>

          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
            See you on the road! 🚗<br>
            - ${schoolName}
          </p>
        </div>
      `,
    });
    console.log(`Reschedule email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send reschedule email:', error);
  }
}

// Lesson reminder email types
export interface LessonReminderEmailParams {
  to: string;
  recipientName: string;
  studentName: string;
  driverName: string;
  schoolName: string;
  lessonDate: string;
  lessonTime: string;
  pickupAddress: string;
}

/**
 * Send a lesson reminder email to a student (24 hours before)
 */
export async function sendStudentLessonReminderEmail(params: LessonReminderEmailParams): Promise<void> {
  const { to } = params;
  const recipientName = escapeHtml(params.recipientName);
  const driverName = escapeHtml(params.driverName);
  const schoolName = escapeHtml(params.schoolName);
  const lessonDate = escapeHtml(params.lessonDate);
  const lessonTime = escapeHtml(params.lessonTime);
  const pickupAddress = escapeHtml(params.pickupAddress);

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set! Student reminder email will not be sent.');
    return;
  }

  console.log(`Sending student lesson reminder email to ${to}...`);

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `⏰ Reminder: Driving Lesson Tomorrow at ${lessonTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">⏰ Lesson Reminder</h2>
          <p>Hi ${recipientName},</p>
          <p>This is a friendly reminder that you have a driving lesson scheduled for <strong>tomorrow</strong>!</p>
          
          <div style="background-color: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #1e40af;">📅 Lesson Details</h3>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${lessonDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${lessonTime}</p>
            <p style="margin: 4px 0;"><strong>Instructor:</strong> ${driverName}</p>
            <p style="margin: 4px 0;"><strong>Pickup Location:</strong> ${pickupAddress}</p>
          </div>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 8px 0; color: #dc2626;">⚠️ IMPORTANT REMINDER</h3>
            <p style="margin: 0; font-weight: bold; color: #991b1b;">
              Please bring your PHYSICAL driver's license (learner's permit) to your lesson.
            </p>
            <p style="margin: 8px 0 0 0; color: #991b1b;">
              A digital copy or photo is <strong>NOT acceptable</strong>. Without your physical license, 
              your lesson will be cancelled.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Need to cancel or reschedule? Log in to your account at 
            <a href="${FRONTEND_URL}">${FRONTEND_URL}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
            See you tomorrow! 🚗<br>
            - ${schoolName}
          </p>
        </div>
      `,
    });
    console.log(`Student lesson reminder email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send student lesson reminder email:', error);
    // Don't throw - email failure shouldn't crash the scheduler
  }
}

/**
 * Send a lesson reminder email to a driver/instructor (24 hours before)
 */
export async function sendDriverLessonReminderEmail(params: LessonReminderEmailParams): Promise<void> {
  const { to } = params;
  const recipientName = escapeHtml(params.recipientName);
  const studentName = escapeHtml(params.studentName);
  const schoolName = escapeHtml(params.schoolName);
  const lessonDate = escapeHtml(params.lessonDate);
  const lessonTime = escapeHtml(params.lessonTime);
  const pickupAddress = escapeHtml(params.pickupAddress);

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set! Driver reminder email will not be sent.');
    return;
  }

  console.log(`Sending driver lesson reminder email to ${to}...`);

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `⏰ Reminder: Lesson Tomorrow with ${studentName} at ${lessonTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">⏰ Lesson Reminder</h2>
          <p>Hi ${recipientName},</p>
          <p>This is a reminder that you have a lesson scheduled for <strong>tomorrow</strong>.</p>
          
          <div style="background-color: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #1e40af;">📅 Lesson Details</h3>
            <p style="margin: 4px 0;"><strong>Student:</strong> ${studentName}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${lessonDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${lessonTime}</p>
            <p style="margin: 4px 0;"><strong>Pickup Location:</strong> ${pickupAddress}</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            View your full schedule at 
            <a href="${FRONTEND_URL}/driver">${FRONTEND_URL}/driver</a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
            - ${schoolName}
          </p>
        </div>
      `,
    });
    console.log(`Driver lesson reminder email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send driver lesson reminder email:', error);
    // Don't throw - email failure shouldn't crash the scheduler
  }
}
