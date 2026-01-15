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
