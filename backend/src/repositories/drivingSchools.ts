import { mapDrivingSchool, DrivingSchool, DrivingSchoolRow, DrivingSchoolStatus } from '../models';
import { getPool } from '../db';

export async function getDrivingSchools(): Promise<DrivingSchool[]> {
  const result = await getPool().query<DrivingSchoolRow>('SELECT * FROM driving_schools ORDER BY id');
  return result.rows.map(mapDrivingSchool);
}

export async function getDrivingSchoolById(id: number): Promise<DrivingSchool | null> {
  const result = await getPool().query<DrivingSchoolRow>('SELECT * FROM driving_schools WHERE id = $1', [id]);
  if (result.rowCount === 0) return null;
  return mapDrivingSchool(result.rows[0]);
}

export async function createDrivingSchool(params: {
  name: string;
  contactEmail?: string;
}): Promise<DrivingSchool> {
  const result = await getPool().query<DrivingSchoolRow>(
    `INSERT INTO driving_schools (name, contact_email, status)
     VALUES ($1, $2, 'suspended')
     RETURNING *`,
    [params.name, params.contactEmail ?? null]
  );
  return mapDrivingSchool(result.rows[0]);
}

export async function activateDrivingSchool(schoolId: number): Promise<DrivingSchool> {
  const result = await getPool().query<DrivingSchoolRow>(
    `UPDATE driving_schools SET status = 'active' WHERE id = $1 RETURNING *`,
    [schoolId],
  );
  if (result.rowCount === 0) throw new Error(`School ${schoolId} not found`);
  return mapDrivingSchool(result.rows[0]);
}

export async function updateDrivingSchool(
  schoolId: number,
  updates: { name?: string; contactEmail?: string | null },
): Promise<DrivingSchool | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    values.push(updates.name);
    fields.push(`name = $${values.length}`);
  }
  if (updates.contactEmail !== undefined) {
    values.push(updates.contactEmail);
    fields.push(`contact_email = $${values.length}`);
  }

  if (fields.length === 0) return getDrivingSchoolById(schoolId);

  values.push(schoolId);
  const result = await getPool().query<DrivingSchoolRow>(
    `UPDATE driving_schools SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING *`,
    values,
  );

  if (result.rowCount === 0) return null;
  return mapDrivingSchool(result.rows[0]);
}

export async function updateDrivingSchoolStatus(
  schoolId: number,
  status: DrivingSchoolStatus,
): Promise<DrivingSchool | null> {
  const result = await getPool().query<DrivingSchoolRow>(
    `UPDATE driving_schools SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, schoolId],
  );
  if (result.rowCount === 0) return null;
  return mapDrivingSchool(result.rows[0]);
}
