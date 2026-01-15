import express from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { UserRole } from '../models';

export function requireAuthenticatedUser(
  req: AuthenticatedRequest,
  res: express.Response,
): req is AuthenticatedRequest & { user: NonNullable<AuthenticatedRequest['user']> } {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return false;
  }
  return true;
}

export function requireRoles(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (!requireAuthenticatedUser(req, res)) return;

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}

export function enforceTenantScope(req: AuthenticatedRequest, res: express.Response): number | null {
  if (!requireAuthenticatedUser(req, res)) {
    return null;
  }

  if (req.user.role === 'SUPERADMIN') {
    return null;
  }

  if (req.user.drivingSchoolId === null) {
    res.status(403).json({ error: 'Driving school context required' });
    return null;
  }

  return req.user.drivingSchoolId;
}
