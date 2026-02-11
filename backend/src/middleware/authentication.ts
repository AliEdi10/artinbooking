import express from 'express';
import { loadUserByIdentity } from '../repositories/users';
import { UserRole } from '../models';
import { verifyJwtFromRequest } from '../services/jwtVerifier';
import { AuthenticatedRequest, AuthenticatedUser } from '../types/auth';

if (process.env.AUTH_EMULATOR === 'true') {
  console.warn('WARNING: AUTH_EMULATOR is enabled. Do NOT use in production!');
}

function respondUnauthorized(res: express.Response, message: string) {
  res.status(401).json({ error: message });
}

function respondForbidden(res: express.Response, message: string) {
  res.status(403).json({ error: message });
}

function buildAuthContext(
  user: Awaited<ReturnType<typeof loadUserByIdentity>>,
  fallbackRole?: UserRole,
  fallbackSchoolId?: number | null,
): AuthenticatedUser | null {
  if (user) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      drivingSchoolId: user.drivingSchoolId,
    };
  }

  if (fallbackRole) {
    return {
      id: -1,
      email: 'emulated-user@example.com',
      role: fallbackRole,
      drivingSchoolId: fallbackSchoolId ?? null,
    };
  }

  return null;
}

interface AuthenticateOptions {
  allowUnregistered?: boolean;
}

export function makeAuthenticateRequest(options: AuthenticateOptions = {}) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      respondUnauthorized(res, 'Missing Bearer token');
      return;
    }

    const token = authHeader.replace('Bearer ', '').trim();

    try {
      const verification = await verifyJwtFromRequest(req, token);
      const user = await loadUserByIdentity(verification.sub, verification.email, verification.provider);

      const typedReq = req as AuthenticatedRequest;
      typedReq.identity = {
        sub: verification.sub,
        email: verification.email,
        provider: verification.provider,
      };

      const authUser = buildAuthContext(user, verification.emulatedRole, verification.emulatedDrivingSchoolId);

      if (!authUser) {
        if (options.allowUnregistered) {
          typedReq.user = null;
          typedReq.tokenClaims = verification.claims;
          next();
          return;
        }

        respondForbidden(res, 'User not registered or disabled');
        return;
      }

      if (user && user.status !== 'active') {
        respondForbidden(res, 'User disabled');
        return;
      }

      typedReq.user = authUser;
      typedReq.tokenClaims = verification.claims;
      next();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Authentication failed', error);
      respondUnauthorized(res, 'Invalid or expired token');
    }
  };
}

export const authenticateRequest = makeAuthenticateRequest();
export const authenticateRequestAllowUnregistered = makeAuthenticateRequest({ allowUnregistered: true });
