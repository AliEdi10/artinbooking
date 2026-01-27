import { getPool } from '../db';
import { Booking, BookingRow, mapBooking } from '../models';

export async function listBookings(
  drivingSchoolId: number,
  filters: { studentId?: number; driverId?: number; status?: string } = {},
): Promise<Booking[]> {
  const clauses = ['driving_school_id = $1'];
  const params: unknown[] = [drivingSchoolId];

  if (filters.studentId) {
    params.push(filters.studentId);
    clauses.push(`student_id = $${params.length}`);
  }

  if (filters.driverId) {
    params.push(filters.driverId);
    clauses.push(`driver_id = $${params.length}`);
  }

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'past') {
      // Past includes completed and cancelled
      clauses.push(`status != 'scheduled'`);
    } else if (filters.status === 'upcoming') {
      clauses.push(`status = 'scheduled'`);
    } else {
      params.push(filters.status);
      clauses.push(`status = $${params.length}`);
    }
  }

  const result = await getPool().query<BookingRow>(
    `SELECT * FROM bookings WHERE ${clauses.join(' AND ')} ORDER BY start_time DESC`,
    params,
  );

  return result.rows.map(mapBooking);
}

export async function countScheduledBookingsForDriverOnDate(
  drivingSchoolId: number,
  driverId: number,
  date: Date,
): Promise<number> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  const result = await getPool().query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM bookings
     WHERE driving_school_id = $1
       AND driver_id = $2
       AND status = 'scheduled'
       AND start_time >= $3
       AND start_time < $4`,
    [drivingSchoolId, driverId, start.toISOString(), end.toISOString()],
  );

  return Number(result.rows[0].count);
}

export async function countScheduledBookingsForStudentOnDate(
  drivingSchoolId: number,
  studentId: number,
  date: Date,
): Promise<number> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  const result = await getPool().query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM bookings
     WHERE driving_school_id = $1
       AND student_id = $2
       AND status = 'scheduled'
       AND start_time >= $3
       AND start_time < $4`,
    [drivingSchoolId, studentId, start.toISOString(), end.toISOString()],
  );

  return Number(result.rows[0].count);
}

export async function getTotalBookedHoursForStudent(
  drivingSchoolId: number,
  studentId: number,
): Promise<number> {
  // Sum all completed and scheduled booking durations
  const result = await getPool().query<{ total_hours: string | null }>(
    `SELECT SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) AS total_hours
     FROM bookings
     WHERE driving_school_id = $1
       AND student_id = $2
       AND status IN ('scheduled', 'completed')`,
    [drivingSchoolId, studentId],
  );

  return Number(result.rows[0].total_hours ?? 0);
}

export async function getBookingById(id: number, drivingSchoolId: number): Promise<Booking | null> {
  const result = await getPool().query<BookingRow>(
    `SELECT * FROM bookings WHERE id = $1 AND driving_school_id = $2`,
    [id, drivingSchoolId],
  );

  if (result.rowCount === 0) return null;
  return mapBooking(result.rows[0]);
}

export interface CreateBookingInput {
  drivingSchoolId: number;
  studentId: number;
  driverId: number;
  pickupAddressId?: number | null;
  dropoffAddressId?: number | null;
  startTime: string | Date;
  endTime: string | Date;
  status?: string;
  cancellationReasonCode?: string | null;
  priceAmount?: number | null;
  notes?: string | null;
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const result = await getPool().query<BookingRow>(
    `INSERT INTO bookings (
      driving_school_id,
      student_id,
      driver_id,
      pickup_address_id,
      dropoff_address_id,
      start_time,
      end_time,
      status,
      cancellation_reason_code,
      price_amount,
      notes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    ) RETURNING *`,
    [
      input.drivingSchoolId,
      input.studentId,
      input.driverId,
      input.pickupAddressId ?? null,
      input.dropoffAddressId ?? null,
      input.startTime,
      input.endTime,
      input.status ?? 'scheduled',
      input.cancellationReasonCode ?? null,
      input.priceAmount ?? null,
      input.notes ?? null,
    ],
  );

  return mapBooking(result.rows[0]);
}

export async function updateBooking(
  id: number,
  drivingSchoolId: number,
  updates: Partial<CreateBookingInput>,
): Promise<Booking | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    fields.push(`${column} = $${fields.length + 1}`);
    values.push(value);
  });

  if (fields.length === 0) return getBookingById(id, drivingSchoolId);

  values.push(id, drivingSchoolId);

  const result = await getPool().query<BookingRow>(
    `UPDATE bookings SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${fields.length + 1} AND driving_school_id = $${fields.length + 2}
     RETURNING *`,
    values,
  );

  if (result.rowCount === 0) return null;
  return mapBooking(result.rows[0]);
}

export async function cancelBooking(
  id: number,
  drivingSchoolId: number,
  status: 'cancelled_by_student' | 'cancelled_by_driver' | 'cancelled_by_school',
  reasonCode?: string | null,
): Promise<Booking | null> {
  const result = await getPool().query<BookingRow>(
    `UPDATE bookings
     SET status = $1,
         cancellation_reason_code = $2,
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE id = $3 AND driving_school_id = $4
     RETURNING *`,
    [status, reasonCode ?? null, id, drivingSchoolId],
  );

  if (result.rowCount === 0) return null;
  return mapBooking(result.rows[0]);
}

/**
 * Get bookings that need reminder emails sent
 * Finds scheduled bookings starting in 23-25 hours that haven't received a reminder yet
 */
export async function getBookingsForReminder(): Promise<BookingRow[]> {
  const now = new Date();
  const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const result = await getPool().query<BookingRow>(
    `SELECT * FROM bookings
     WHERE status = 'scheduled'
       AND reminder_sent_at IS NULL
       AND start_time >= $1
       AND start_time <= $2
     ORDER BY start_time ASC`,
    [in23Hours.toISOString(), in25Hours.toISOString()],
  );

  return result.rows;
}

/**
 * Mark a booking as having had its reminder sent
 */
export async function markReminderSent(bookingId: number): Promise<void> {
  await getPool().query(
    `UPDATE bookings SET reminder_sent_at = NOW() WHERE id = $1`,
    [bookingId],
  );
}
