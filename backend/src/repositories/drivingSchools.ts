import { mapDrivingSchool, DrivingSchool, DrivingSchoolRow } from '../models';
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
