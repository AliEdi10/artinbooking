import { getPool } from '../db';
import { DriverProfile, DriverProfileRow, mapDriverProfile } from '../models';

export async function listDriverProfiles(drivingSchoolId: number): Promise<DriverProfile[]> {
  const result = await getPool().query<DriverProfileRow>(
    `SELECT *, 
      service_center_location
     FROM driver_profiles WHERE driving_school_id = $1 ORDER BY id`,
    [drivingSchoolId],
  );
  return result.rows.map(mapDriverProfile);
}

export async function getDriverProfileById(
  id: number,
  drivingSchoolId: number,
): Promise<DriverProfile | null> {
  const result = await getPool().query<DriverProfileRow>(
    `SELECT *, 
      service_center_location
     FROM driver_profiles WHERE id = $1 AND driving_school_id = $2`,
    [id, drivingSchoolId],
  );
  if (result.rowCount === 0) return null;
  return mapDriverProfile(result.rows[0]);
}

export async function getDriverProfileByUserId(
  userId: number,
  drivingSchoolId: number,
): Promise<DriverProfile | null> {
  const result = await getPool().query<DriverProfileRow>(
    `SELECT *, 
      service_center_location
     FROM driver_profiles WHERE user_id = $1 AND driving_school_id = $2`,
    [userId, drivingSchoolId],
  );
  if (result.rowCount === 0) return null;
  return mapDriverProfile(result.rows[0]);
}

export interface CreateDriverProfileInput {
  userId: number;
  drivingSchoolId: number;
  fullName: string;
  phone?: string;
  email?: string;
  serviceCenterLocation?: unknown;
  workDayStart?: string;
  workDayEnd?: string;
  lessonDurationMinutes?: number;
  bufferMinutesBetweenLessons?: number;
  serviceRadiusKm?: number;
  maxSegmentTravelTimeMin?: number;
  maxSegmentTravelDistanceKm?: number;
  dailyMaxTravelTimeMin?: number;
  dailyMaxTravelDistanceKm?: number;
  notes?: string;
  active?: boolean;
}

export async function createDriverProfile(input: CreateDriverProfileInput): Promise<DriverProfile> {
  const result = await getPool().query<DriverProfileRow>(
    `INSERT INTO driver_profiles (
      user_id,
      driving_school_id,
      full_name,
      phone,
      email,
      service_center_location,
      work_day_start,
      work_day_end,
      lesson_duration_minutes,
      buffer_minutes_between_lessons,
      service_radius_km,
      max_segment_travel_time_min,
      max_segment_travel_distance_km,
      daily_max_travel_time_min,
      daily_max_travel_distance_km,
      notes,
      active
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
    ) RETURNING *`,
    [
      input.userId,
      input.drivingSchoolId,
      input.fullName,
      input.phone ?? null,
      input.email ?? null,
      input.serviceCenterLocation ?? null,
      input.workDayStart ?? null,
      input.workDayEnd ?? null,
      input.lessonDurationMinutes ?? null,
      input.bufferMinutesBetweenLessons ?? null,
      input.serviceRadiusKm ?? null,
      input.maxSegmentTravelTimeMin ?? null,
      input.maxSegmentTravelDistanceKm ?? null,
      input.dailyMaxTravelTimeMin ?? null,
      input.dailyMaxTravelDistanceKm ?? null,
      input.notes ?? null,
      input.active ?? true,
    ],
  );

  return mapDriverProfile(result.rows[0]);
}

export async function updateDriverProfile(
  id: number,
  drivingSchoolId: number,
  updates: Partial<CreateDriverProfileInput>,
): Promise<DriverProfile | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  const allowedColumns = new Set(['full_name', 'phone', 'email', 'service_center_location', 'work_day_start', 'work_day_end', 'lesson_duration_minutes', 'buffer_minutes_between_lessons', 'service_radius_km', 'max_segment_travel_time_min', 'max_segment_travel_distance_km', 'daily_max_travel_time_min', 'daily_max_travel_distance_km', 'notes', 'active']);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    if (!allowedColumns.has(column)) return;
    fields.push(`${column} = $${fields.length + 1}`);
    values.push(value);
  });

  if (fields.length === 0) return getDriverProfileById(id, drivingSchoolId);

  values.push(id, drivingSchoolId);

  const result = await getPool().query<DriverProfileRow>(
    `UPDATE driver_profiles SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${fields.length + 1} AND driving_school_id = $${fields.length + 2}
     RETURNING *`,
    values,
  );

  if (result.rowCount === 0) return null;
  return mapDriverProfile(result.rows[0]);
}
