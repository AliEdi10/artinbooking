import { getPool } from '../db';
import { SchoolInvitation, SchoolInvitationRow, UserRole, mapSchoolInvitation } from '../models';

export async function upsertInvitation(params: {
  drivingSchoolId: number;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: Date;
  fullName?: string;
  allowedHours?: number;
  maxLessonsPerDay?: number;
}): Promise<SchoolInvitation> {
  const result = await getPool().query<SchoolInvitationRow>(
    `INSERT INTO school_invitations (driving_school_id, email, role, token, expires_at, full_name, allowed_hours, max_lessons_per_day)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (driving_school_id, email, role) DO UPDATE SET
       token = EXCLUDED.token,
       expires_at = EXCLUDED.expires_at,
       full_name = EXCLUDED.full_name,
       allowed_hours = EXCLUDED.allowed_hours,
       max_lessons_per_day = EXCLUDED.max_lessons_per_day,
       accepted_at = NULL,
       updated_at = NOW()
     RETURNING *`,
    [params.drivingSchoolId, params.email.toLowerCase(), params.role, params.token, params.expiresAt, params.fullName ?? null, params.allowedHours ?? null, params.maxLessonsPerDay ?? null],
  );

  return mapSchoolInvitation(result.rows[0]);
}

export async function findInvitationByToken(token: string): Promise<SchoolInvitation | null> {
  const result = await getPool().query<SchoolInvitationRow>(
    'SELECT * FROM school_invitations WHERE token = $1 LIMIT 1',
    [token],
  );

  if (result.rowCount === 0) return null;

  return mapSchoolInvitation(result.rows[0]);
}

export async function markInvitationAccepted(id: number): Promise<SchoolInvitation> {
  const result = await getPool().query<SchoolInvitationRow>(
    'UPDATE school_invitations SET accepted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
    [id],
  );

  return mapSchoolInvitation(result.rows[0]);
}

export async function getPendingInvitations(drivingSchoolId: number): Promise<SchoolInvitation[]> {
  const result = await getPool().query<SchoolInvitationRow>(
    `SELECT * FROM school_invitations
     WHERE driving_school_id = $1
       AND accepted_at IS NULL
     ORDER BY created_at DESC`,
    [drivingSchoolId],
  );

  return result.rows.map(mapSchoolInvitation);
}

export async function getInvitationById(id: number, drivingSchoolId: number): Promise<SchoolInvitation | null> {
  const result = await getPool().query<SchoolInvitationRow>(
    'SELECT * FROM school_invitations WHERE id = $1 AND driving_school_id = $2 LIMIT 1',
    [id, drivingSchoolId],
  );

  if (result.rowCount === 0) return null;
  return mapSchoolInvitation(result.rows[0]);
}

export async function resendInvitation(
  id: number,
  drivingSchoolId: number,
  newToken: string,
  newExpiresAt: Date,
): Promise<SchoolInvitation | null> {
  const result = await getPool().query<SchoolInvitationRow>(
    `UPDATE school_invitations
     SET token = $1, expires_at = $2, updated_at = NOW()
     WHERE id = $3 AND driving_school_id = $4 AND accepted_at IS NULL
     RETURNING *`,
    [newToken, newExpiresAt, id, drivingSchoolId],
  );

  if (result.rowCount === 0) return null;
  return mapSchoolInvitation(result.rows[0]);
}
