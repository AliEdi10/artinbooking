import { getPool } from '../db';
import { StudentAddress, StudentAddressRow, mapStudentAddress } from '../models';

export async function listAddressesForSchool(drivingSchoolId: number): Promise<StudentAddress[]> {
  const result = await getPool().query<StudentAddressRow>(
    `SELECT * FROM addresses WHERE driving_school_id = $1 ORDER BY id`,
    [drivingSchoolId],
  );
  return result.rows.map(mapStudentAddress);
}

export async function listAddressesForStudent(
  studentId: number,
  drivingSchoolId: number,
): Promise<StudentAddress[]> {
  const result = await getPool().query<StudentAddressRow>(
    `SELECT * FROM addresses WHERE student_id = $1 AND driving_school_id = $2 ORDER BY id`,
    [studentId, drivingSchoolId],
  );
  return result.rows.map(mapStudentAddress);
}

export async function getAddressById(
  id: number,
  drivingSchoolId: number,
): Promise<StudentAddress | null> {
  const result = await getPool().query<StudentAddressRow>(
    `SELECT * FROM addresses WHERE id = $1 AND driving_school_id = $2`,
    [id, drivingSchoolId],
  );
  if (result.rowCount === 0) return null;
  return mapStudentAddress(result.rows[0]);
}

export async function getAddressesByIds(
  ids: number[],
  drivingSchoolId: number,
): Promise<Map<number, StudentAddress>> {
  if (ids.length === 0) return new Map();
  const uniqueIds = [...new Set(ids)];
  const placeholders = uniqueIds.map((_, i) => `$${i + 2}`).join(',');
  const result = await getPool().query<StudentAddressRow>(
    `SELECT * FROM addresses WHERE id IN (${placeholders}) AND driving_school_id = $1`,
    [drivingSchoolId, ...uniqueIds],
  );
  const map = new Map<number, StudentAddress>();
  for (const row of result.rows) {
    map.set(row.id, mapStudentAddress(row));
  }
  return map;
}

export interface CreateAddressInput {
  drivingSchoolId: number;
  studentId?: number;
  label?: string;
  line1: string;
  line2?: string;
  city?: string;
  provinceOrState?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isDefaultPickup?: boolean;
  isDefaultDropoff?: boolean;
  active?: boolean;
}

export async function createAddress(input: CreateAddressInput): Promise<StudentAddress> {
  const result = await getPool().query<StudentAddressRow>(
    `INSERT INTO addresses (
      driving_school_id,
      student_id,
      label,
      line1,
      line2,
      city,
      province_or_state,
      postal_code,
      country,
      latitude,
      longitude,
      is_default_pickup,
      is_default_dropoff,
      active
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    ) RETURNING *`,
    [
      input.drivingSchoolId,
      input.studentId ?? null,
      input.label ?? null,
      input.line1,
      input.line2 ?? null,
      input.city ?? null,
      input.provinceOrState ?? null,
      input.postalCode ?? null,
      input.country ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.isDefaultPickup ?? false,
      input.isDefaultDropoff ?? false,
      input.active ?? true,
    ],
  );

  return mapStudentAddress(result.rows[0]);
}

export async function updateAddress(
  id: number,
  drivingSchoolId: number,
  updates: Partial<CreateAddressInput>,
): Promise<StudentAddress | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  const allowedColumns = new Set(['label', 'line1', 'line2', 'city', 'province_or_state', 'postal_code', 'country', 'latitude', 'longitude', 'is_default_pickup', 'is_default_dropoff', 'active']);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    if (!allowedColumns.has(column)) return;
    fields.push(`${column} = $${fields.length + 1}`);
    values.push(value);
  });

  if (fields.length === 0) return getAddressById(id, drivingSchoolId);

  values.push(id, drivingSchoolId);

  const result = await getPool().query<StudentAddressRow>(
    `UPDATE addresses SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${fields.length + 1} AND driving_school_id = $${fields.length + 2}
     RETURNING *`,
    values,
  );

  if (result.rowCount === 0) return null;
  return mapStudentAddress(result.rows[0]);
}
