import { getPool } from '../db';
import { User, UserRole, UserRow, UserStatus, mapUser } from '../models';

export async function loadUserByIdentity(
  sub?: string,
  email?: string,
  provider = process.env.AUTH_PROVIDER || 'google',
): Promise<User | null> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (sub) {
    const providerIndex = params.length + 1;
    params.push(provider);
    const subjectIndex = params.length + 1;
    params.push(sub);
    clauses.push(`(identity_provider = $${providerIndex} AND identity_subject = $${subjectIndex})`);
  }

  if (email) {
    const emailIndex = params.length + 1;
    params.push(email.toLowerCase());
    clauses.push(`LOWER(email) = $${emailIndex}`);
  }

  if (clauses.length === 0) return null;

  const result = await getPool().query<UserRow>(
    `SELECT * FROM users WHERE ${clauses.join(' OR ')} LIMIT 1`,
    params,
  );

  if (result.rowCount === 0) return null;

  return mapUser(result.rows[0]);
}

export async function getUserById(id: number): Promise<User | null> {
  const result = await getPool().query<UserRow>(
    `SELECT * FROM users WHERE id = $1 LIMIT 1`,
    [id],
  );

  if (result.rowCount === 0) return null;
  return mapUser(result.rows[0]);
}

export async function createUserWithIdentity(
  params: {
    drivingSchoolId: number | null;
    email: string;
    identityProvider: string;
    identitySubject: string;
    role: UserRole;
    status?: UserStatus;
  },
): Promise<User> {
  const normalizedEmail = params.email.toLowerCase();

  // Check if user already exists with a different school
  const existing = await getPool().query<UserRow>(
    `SELECT * FROM users WHERE identity_provider = $1 AND identity_subject = $2 LIMIT 1`,
    [params.identityProvider, params.identitySubject],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    const existingUser = mapUser(existing.rows[0]);
    if (existingUser.drivingSchoolId && params.drivingSchoolId &&
        existingUser.drivingSchoolId !== params.drivingSchoolId) {
      throw new Error('User already belongs to another driving school');
    }
  }

  const result = await getPool().query<UserRow>(
    `INSERT INTO users (driving_school_id, email, identity_provider, identity_subject, role, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (identity_provider, identity_subject) DO UPDATE SET
       driving_school_id = EXCLUDED.driving_school_id,
       email = EXCLUDED.email,
       role = EXCLUDED.role,
       status = EXCLUDED.status
     RETURNING *`,
    [
      params.drivingSchoolId,
      normalizedEmail,
      params.identityProvider,
      params.identitySubject,
      params.role,
      params.status ?? 'active',
    ],
  );

  return mapUser(result.rows[0]);
}

export async function countAdminsForSchool(drivingSchoolId: number): Promise<number> {
  const result = await getPool().query<{ count: string }>(
    `SELECT COUNT(*) as count FROM users WHERE driving_school_id = $1 AND role = 'SCHOOL_ADMIN'`,
    [drivingSchoolId],
  );

  return Number(result.rows[0].count);
}

export async function createUserWithPassword(
  params: {
    drivingSchoolId: number | null;
    email: string;
    passwordHash: string;
    role: UserRole;
    status?: UserStatus;
  },
): Promise<User> {
  const normalizedEmail = params.email.toLowerCase();

  const result = await getPool().query<UserRow>(
    `INSERT INTO users (driving_school_id, email, password_hash, role, status, identity_provider, identity_subject)
     VALUES ($1, $2, $3, $4, $5, 'local', NULL)
     RETURNING *`,
    [
      params.drivingSchoolId,
      normalizedEmail,
      params.passwordHash,
      params.role,
      params.status ?? 'active',
    ],
  );

  return mapUser(result.rows[0]);
}
