import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_NAME = process.env.APP_NAME || 'Artin Driving School';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://artinbooking.vercel.app';

export interface SendInvitationEmailParams {
    to: string;
    inviteeName: string;
    role: string;
    schoolName: string;
    invitationToken: string;
}

export async function sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
    const { to, inviteeName, role, schoolName, invitationToken } = params;

    const registrationUrl = `${FRONTEND_URL}/register?token=${invitationToken}`;

    const roleDisplay = role === 'STUDENT' ? 'student' : role === 'DRIVER' ? 'instructor' : 'team member';

    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `You're invited to join ${schoolName}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Welcome to ${APP_NAME}!</h2>
          <p>Hi ${inviteeName || 'there'},</p>
          <p>You've been invited to join <strong>${schoolName}</strong> as a ${roleDisplay}.</p>
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
        console.log(`Invitation email sent to ${to}`);
    } catch (error) {
        console.error('Failed to send invitation email:', error);
        throw error;
    }
}

export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
        await resend.emails.send({
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
