import crypto from 'crypto';
import cors from 'cors';
import express from 'express';
import { authenticateRequest, authenticateRequestAllowUnregistered } from './middleware/authentication';
import { enforceTenantScope, requireRoles } from './middleware/authorization';
import { getDrivingSchoolById, getDrivingSchools, createDrivingSchool } from './repositories/drivingSchools';
import { findInvitationByToken, markInvitationAccepted, upsertInvitation, getPendingInvitations, getInvitationById, resendInvitation, deleteInvitation } from './repositories/invitations';
import { countAdminsForSchool, createUserWithIdentity, createUserWithPassword, getUserById } from './repositories/users';
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
import { createAddress, getAddressById, listAddressesForStudent, updateAddress } from './repositories/studentAddresses';
import { cancelBooking, createBooking, getBookingById, listBookings, updateBooking, countScheduledBookingsForStudentOnDate, getTotalBookedHoursForStudent } from './repositories/bookings';
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

function resolveSchoolContext(req: AuthenticatedRequest, res: express.Response): number | null {
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

  return requestedSchoolId;
}

const travelCalculator = buildGoogleMapsTravelCalculatorFromEnv();

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

  const enriched: BookingWithLocations[] = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const booking of bookings) {
    if (booking.status !== 'scheduled') continue;
    if (booking.startTime.toISOString().slice(0, 10) !== date.toISOString().slice(0, 10)) continue;
    // eslint-disable-next-line no-await-in-loop
    const pickupAddress = booking.pickupAddressId
      ? await getAddressById(booking.pickupAddressId, drivingSchoolId)
      : null;
    // eslint-disable-next-line no-await-in-loop
    const dropoffAddress = booking.dropoffAddressId
      ? await getAddressById(booking.dropoffAddressId, drivingSchoolId)
      : null;

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
import { generalLimiter, authLimiter } from './middleware/rateLimit';
import { httpLogger, logger } from './middleware/logging';

export function createApp() {
  const app = express();

  // Request logging (first, to capture all requests)
  app.use(httpLogger);

  app.use(cors());
  app.use(express.json());

  // Apply general rate limiting to all routes
  app.use(generalLimiter);

  // Apply stricter rate limiting to auth routes
  app.use('/auth', authLimiter, authRouter);

  // Mount analytics routes
  app.use(analyticsRouter);

  app.get('/health', (_req, res) => {
    res.send('OK');
  });

  app.get('/hello', (_req, res) => {
    res.json({ message: 'Hello from artinbk backend' });
  });

  app.post('/auth/local-token', (req, res) => {
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
        const schoolId = resolveSchoolContext(req, res);
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
        const schoolId = resolveSchoolContext(req, res);
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
        const schoolId = resolveSchoolContext(req, res);
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
        const schoolId = resolveSchoolContext(req, res);
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
          try {
            await createStudentProfile({
              userId: user.id,
              drivingSchoolId: invitation.drivingSchoolId,
              fullName: fullName || invitation.fullName || invitation.email.split('@')[0],
              phone: phone,
              isMinor: isMinor ?? false,
              guardianPhone: isMinor ? guardianPhone : undefined,
              guardianEmail: isMinor ? guardianEmail : undefined,
            });
          } catch (profileError) {
            console.error('Failed to create student profile:', profileError);
            // Don't fail the whole registration - profile can be created later
          }
        }

        // Create driver profile if role is DRIVER
        if (invitation.role === 'DRIVER' && user) {
          try {
            await createDriverProfile({
              userId: user.id,
              drivingSchoolId: invitation.drivingSchoolId,
              fullName: fullName || invitation.fullName || invitation.email.split('@')[0],
            });
          } catch (profileError) {
            console.error('Failed to create driver profile:', profileError);
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
        const schoolId = resolveSchoolContext(req, res);
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
        const schoolId = resolveSchoolContext(req, res);
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
        const schoolId = resolveSchoolContext(req, res);
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

        const updated = await updateDriverProfile(driverId, schoolId, req.body);
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
        const schoolId = resolveSchoolContext(req, res);
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
        const schoolId = resolveSchoolContext(req, res);
        if (!schoolId) return;

        const body = req.body as Partial<CreateStudentProfileInput>;
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
        const schoolId = resolveSchoolContext(req, res);
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
        const body = req.body as Record<string, unknown>;
        if (req.user?.role === 'STUDENT' && body.licenceStatus !== undefined) {
          res.status(403).json({ error: 'Students cannot change their licence status. Please wait for admin or instructor approval.' });
          return;
        }

        // If student updates licence info, reset status to pending_review (require re-approval)
        const licenceFields = ['licenceNumber', 'licenceImageUrl', 'licenceExpiryDate', 'licenceProvinceOrState'];
        const isLicenceUpdate = req.user?.role === 'STUDENT' && licenceFields.some((field) => body[field] !== undefined);
        const updateData = { ...req.body };
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
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = resolveSchoolContext(req, res);
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

  app.get(
    '/schools/:schoolId/students/:studentId/addresses',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = resolveSchoolContext(req, res);
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
        const schoolId = resolveSchoolContext(req, res);
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

        const { line1 } = req.body as { line1?: string };
        if (!line1) {
          res.status(400).json({ error: 'line1 is required' });
          return;
        }

        const address = await createAddress({
          ...req.body,
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
        const schoolId = resolveSchoolContext(req, res);
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

        const updated = await updateAddress(addressId, schoolId, req.body);
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
        const schoolId = resolveSchoolContext(req, res);
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
        const schoolId = resolveSchoolContext(req, res);
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

        const { date, startTime, endTime } = req.body as {
          date?: string;
          startTime?: string;
          endTime?: string;
        };

        if (!date || !startTime || !endTime) {
          res.status(400).json({ error: 'date, startTime, and endTime are required' });
          return;
        }

        const record = await createAvailability(driverId, schoolId, req.body);
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
        const schoolId = resolveSchoolContext(req, res);
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
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = resolveSchoolContext(req, res);
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

        const slots = (await computeAvailableSlots(availabilityRequest, travelCalculator)).filter((slot) => {
          if (!settings?.minBookingLeadTimeHours) return true;
          const cutoff = Date.now() + settings.minBookingLeadTimeHours * 60 * 60 * 1000;
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
        const schoolId = resolveSchoolContext(req, res);
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
        const schoolId = resolveSchoolContext(req, res);
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
          if (settings && !settings.allowStudentToPickDriver && body.driverId !== undefined) {
            res.status(403).json({ error: 'Students cannot pick drivers for this school' });
            return;
          }
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

        if (settings?.minBookingLeadTimeHours) {
          const cutoff = Date.now() + settings.minBookingLeadTimeHours * 60 * 60 * 1000;
          if (startTime.getTime() < cutoff) {
            res.status(400).json({ error: 'Requested slot violates minimum lead time' });
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

        if (settings?.minBookingLeadTimeHours) {
          const cutoff = Date.now() + settings.minBookingLeadTimeHours * 60 * 60 * 1000;
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

        const booking = await createBooking({
          ...req.body,
          drivingSchoolId: schoolId,
          studentId,
          driverId: driver.id,
          startTime: normalizedStart.toISOString(),
          endTime: endTime.toISOString(),
        });

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
        const schoolId = resolveSchoolContext(req, res);
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

        const updated = await updateBooking(bookingId, schoolId, req.body);
        res.json(updated);
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
        const schoolId = resolveSchoolContext(req, res);
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

  app.get(
    '/schools/:schoolId/settings',
    authenticateRequest,
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = resolveSchoolContext(req, res);
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
    requireRoles(['SUPERADMIN', 'SCHOOL_ADMIN']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const schoolId = resolveSchoolContext(req, res);
        if (!schoolId) return;

        const settings = await upsertSchoolSettings(schoolId, req.body);
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
