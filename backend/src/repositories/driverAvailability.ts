import { getPool } from '../db';
import { DriverAvailability, DriverAvailabilityRow, mapDriverAvailability } from '../models';

export async function listAvailability(
  driverId: number,
  drivingSchoolId: number,
): Promise<DriverAvailability[]> {
  const result = await getPool().query<DriverAvailabilityRow>(
    `SELECT * FROM driver_availability WHERE driver_id = $1 AND driving_school_id = $2 ORDER BY date, start_time`,
    [driverId, drivingSchoolId],
  );

  return result.rows.map(mapDriverAvailability);
}

export interface DriverHolidayWithName extends DriverAvailability {
  driverName: string;
}

export async function getDriverHolidaysForSchool(
  drivingSchoolId: number,
): Promise<DriverHolidayWithName[]> {
  const result = await getPool().query<DriverAvailabilityRow & { driver_name: string }>(
    `SELECT da.*, dp.full_name as driver_name
     FROM driver_availability da
     JOIN driver_profiles dp ON dp.id = da.driver_id AND dp.driving_school_id = da.driving_school_id
     WHERE da.driving_school_id = $1
       AND da.type = 'override_closed'
       AND da.date >= CURRENT_DATE
     ORDER BY da.date, dp.full_name`,
    [drivingSchoolId],
  );

  return result.rows.map((row) => ({
    ...mapDriverAvailability(row),
    driverName: row.driver_name,
  }));
}

export async function createAvailability(
  driverId: number,
  drivingSchoolId: number,
  input: {
    date: string;
    startTime: string;
    endTime: string;
    type?: string;
    notes?: string;
  },
): Promise<DriverAvailability> {
  const result = await getPool().query<DriverAvailabilityRow>(
    `INSERT INTO driver_availability (
      driving_school_id,
      driver_id,
      date,
      start_time,
      end_time,
      type,
      notes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7
    ) RETURNING *`,
    [
      drivingSchoolId,
      driverId,
      input.date,
      input.startTime,
      input.endTime,
      input.type ?? 'working_hours',
      input.notes ?? null,
    ],
  );

  return mapDriverAvailability(result.rows[0]);
}

export async function deleteAvailability(
  availabilityId: number,
  driverId: number,
  drivingSchoolId: number,
): Promise<boolean> {
  const result = await getPool().query(
    `DELETE FROM driver_availability WHERE id = $1 AND driver_id = $2 AND driving_school_id = $3`,
    [availabilityId, driverId, drivingSchoolId],
  );

  return (result.rowCount ?? 0) > 0;
}
