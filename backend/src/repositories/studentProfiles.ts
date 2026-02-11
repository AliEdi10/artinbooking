import { getPool } from '../db';
import { StudentProfile, StudentProfileRow, mapStudentProfile } from '../models';

export async function listStudentProfiles(drivingSchoolId: number): Promise<StudentProfile[]> {
  const result = await getPool().query<StudentProfileRow>(
    `SELECT * FROM student_profiles WHERE driving_school_id = $1 ORDER BY id`,
    [drivingSchoolId],
  );
  return result.rows.map(mapStudentProfile);
}

export async function getStudentProfileById(
  id: number,
  drivingSchoolId: number,
): Promise<StudentProfile | null> {
  const result = await getPool().query<StudentProfileRow>(
    `SELECT * FROM student_profiles WHERE id = $1 AND driving_school_id = $2`,
    [id, drivingSchoolId],
  );
  if (result.rowCount === 0) return null;
  return mapStudentProfile(result.rows[0]);
}

export async function getStudentProfileByUserId(
  userId: number,
  drivingSchoolId: number,
): Promise<StudentProfile | null> {
  const result = await getPool().query<StudentProfileRow>(
    `SELECT * FROM student_profiles WHERE user_id = $1 AND driving_school_id = $2`,
    [userId, drivingSchoolId],
  );
  if (result.rowCount === 0) return null;
  return mapStudentProfile(result.rows[0]);
}

export interface CreateStudentProfileInput {
  userId: number;
  drivingSchoolId: number;
  fullName: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  licenceNumber?: string;
  licenceExpiryDate?: string;
  licenceProvinceOrState?: string;
  licenceImageUrl?: string;
  licenceStatus?: string;
  isMinor?: boolean;
  guardianPhone?: string;
  guardianEmail?: string;
  active?: boolean;
}

export async function createStudentProfile(input: CreateStudentProfileInput): Promise<StudentProfile> {
  const result = await getPool().query<StudentProfileRow>(
    `INSERT INTO student_profiles (
      user_id,
      driving_school_id,
      full_name,
      date_of_birth,
      phone,
      email,
      licence_number,
      licence_expiry_date,
      licence_province_or_state,
      licence_image_url,
      licence_status,
      is_minor,
      guardian_phone,
      guardian_email,
      active
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
    ) RETURNING *`,
    [
      input.userId,
      input.drivingSchoolId,
      input.fullName,
      input.dateOfBirth ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.licenceNumber ?? null,
      input.licenceExpiryDate ?? null,
      input.licenceProvinceOrState ?? null,
      input.licenceImageUrl ?? null,
      input.licenceStatus ?? 'pending_review',
      input.isMinor ?? false,
      input.guardianPhone ?? null,
      input.guardianEmail ?? null,
      input.active ?? true,
    ],
  );

  return mapStudentProfile(result.rows[0]);
}

export async function updateStudentProfile(
  id: number,
  drivingSchoolId: number,
  updates: Partial<CreateStudentProfileInput>,
): Promise<StudentProfile | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  const allowedColumns = new Set(['full_name', 'date_of_birth', 'phone', 'email', 'licence_number', 'licence_expiry_date', 'licence_province_or_state', 'licence_image_url', 'licence_status', 'licence_rejection_note', 'allowed_hours', 'max_lessons_per_day', 'is_minor', 'guardian_phone', 'guardian_email', 'active']);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    if (!allowedColumns.has(column)) return;
    fields.push(`${column} = $${fields.length + 1}`);
    values.push(value);
  });

  if (fields.length === 0) return getStudentProfileById(id, drivingSchoolId);

  values.push(id, drivingSchoolId);

  const result = await getPool().query<StudentProfileRow>(
    `UPDATE student_profiles SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${fields.length + 1} AND driving_school_id = $${fields.length + 2}
     RETURNING *`,
    values,
  );

  if (result.rowCount === 0) return null;
  return mapStudentProfile(result.rows[0]);
}
