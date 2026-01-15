import express from 'express';
import { UserRole } from '../models';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRole;
  drivingSchoolId: number | null;
}

export interface RequestIdentity {
  sub?: string;
  email?: string;
  provider?: string;
}

export interface AuthenticatedRequest extends express.Request {
  user?: AuthenticatedUser | null;
  tokenClaims?: Record<string, unknown>;
  identity?: RequestIdentity;
}
