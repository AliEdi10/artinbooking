import { exec as execCb } from 'child_process';
import path from 'path';
import util from 'util';
import request from 'supertest';
import { Pool, PoolConfig } from 'pg';
import { createApp } from '../../src/app';
import { getPool, closePool } from '../../src/db';
import { runMigrations } from '../../src/db/migrations';

const exec = util.promisify(execCb);

const dbConfig: PoolConfig = {
  host: '127.0.0.1',
  port: 55432,
  user: 'postgres',
  password: 'postgres',
  database: 'artinbk_test',
};

const containerName = `artinbk-test-${Date.now()}-bookings`;
const migrationsPath = path.resolve(__dirname, '../../../db/migrations');

async function waitForDatabase(config: PoolConfig, timeoutMs = 30000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const probePool = new Pool({ ...config, max: 1 });
      await probePool.query('SELECT 1');
      await probePool.end();
      return;
    } catch (error) {
      if (Date.now() - start > timeoutMs) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

describe('Bookings and availability API', () => {
  let pool: Pool;
  let schoolId: number;
  let driverId: number;
  let approvedStudentId: number;
  let pendingStudentId: number;
  let approvedPickupId: number;
  let approvedDropoffId: number;
  let pendingPickupId: number;
  let pendingDropoffId: number;

  beforeAll(async () => {
    await exec(
      [
        'docker run --rm -d',
        `-p ${dbConfig.port}:5432`,
        `-e POSTGRES_USER=${dbConfig.user}`,
        `-e POSTGRES_PASSWORD=${dbConfig.password}`,
        `-e POSTGRES_DB=${dbConfig.database}`,
        `--name ${containerName}`,
        'postgres:16-alpine',
      ].join(' '),
    );

    await waitForDatabase(dbConfig);

    process.env.PGHOST = dbConfig.host;
    process.env.PGPORT = String(dbConfig.port);
    process.env.PGUSER = dbConfig.user;
    process.env.PGPASSWORD = dbConfig.password;
    process.env.PGDATABASE = dbConfig.database;

    process.env.AUTH_EMULATOR = 'true';
    process.env.AUTH_EMULATOR_EMAIL = 'superadmin@example.com';
    process.env.AUTH_EMULATOR_ROLE = 'SUPERADMIN';
    process.env.AUTH_PROVIDER = 'google';

    pool = getPool(dbConfig);
    await runMigrations(pool, migrationsPath);

    const schoolResult = await pool.query(
      `INSERT INTO driving_schools (name, city, province_or_state, country)
       VALUES ($1, $2, $3, $4) RETURNING id`
        .replace(/\n/g, ' '),
      ['Bookings Test School', 'Halifax', 'NS', 'Canada'],
    );
    schoolId = Number(schoolResult.rows[0].id);

    await pool.query(
      `INSERT INTO users (email, identity_provider, identity_subject, role, status, driving_school_id)
       VALUES ($1, $2, $3, 'SUPERADMIN', 'active', $4)`,
      ['superadmin@example.com', 'emulated', 'superadmin-emulated', schoolId],
    );

    const driverUser = await pool.query(
      `INSERT INTO users (email, identity_provider, identity_subject, role, status, driving_school_id)
       VALUES ($1, $2, $3, 'DRIVER', 'active', $4) RETURNING id`,
      ['driver@example.com', 'google', 'driver-subject', schoolId],
    );

    const studentUser = await pool.query(
      `INSERT INTO users (email, identity_provider, identity_subject, role, status, driving_school_id)
       VALUES ($1, $2, $3, 'STUDENT', 'active', $4) RETURNING id`,
      ['student@example.com', 'google', 'student-subject', schoolId],
    );

    const pendingUser = await pool.query(
      `INSERT INTO users (email, identity_provider, identity_subject, role, status, driving_school_id)
       VALUES ($1, $2, $3, 'STUDENT', 'active', $4) RETURNING id`,
      ['pending@example.com', 'google', 'pending-subject', schoolId],
    );

    const driverProfile = await pool.query(
      `INSERT INTO driver_profiles (
        user_id, driving_school_id, full_name, phone, service_center_location, work_day_start, work_day_end,
        lesson_duration_minutes, buffer_minutes_between_lessons, service_radius_km, max_segment_travel_time_min,
        max_segment_travel_distance_km, active
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
      ) RETURNING id`,
      [
        driverUser.rows[0].id,
        schoolId,
        'Driver One',
        null,
        JSON.stringify({ latitude: 44.64, longitude: -63.57 }),
        '09:00',
        '17:00',
        60,
        0,
        25,
        120,
        50,
        true,
      ],
    );
    driverId = Number(driverProfile.rows[0].id);

    const settingsInsert = await pool.query(
      `INSERT INTO school_settings (
        driving_school_id, min_booking_lead_time_hours, cancellation_cutoff_hours, default_lesson_duration_minutes,
        default_buffer_minutes_between_lessons, default_service_radius_km, default_max_segment_travel_time_min,
        default_max_segment_travel_distance_km
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [schoolId, 0, 24, 60, 0, 50, 180, 100],
    );
    expect(settingsInsert.rowCount).toBe(1);

    const studentProfile = await pool.query(
      `INSERT INTO student_profiles (
        user_id, driving_school_id, full_name, phone, email, licence_number, licence_status, active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [studentUser.rows[0].id, schoolId, 'Approved Student', null, 'student@example.com', 'X123', 'approved', true],
    );
    approvedStudentId = Number(studentProfile.rows[0].id);

    const pendingProfile = await pool.query(
      `INSERT INTO student_profiles (
        user_id, driving_school_id, full_name, phone, email, licence_number, licence_status, active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [pendingUser.rows[0].id, schoolId, 'Pending Student', null, 'pending@example.com', 'X124', 'pending_review', true],
    );
    pendingStudentId = Number(pendingProfile.rows[0].id);

    const approvedAddresses = await pool.query(
      `INSERT INTO addresses (
        driving_school_id, student_id, label, line1, city, province_or_state, country, latitude, longitude,
        is_default_pickup, is_default_dropoff, active
      ) VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,true,true),
        ($1,$2,$10,$11,$12,$13,$14,$15,$16,false,false,true)
      RETURNING id`,
      [
        schoolId,
        approvedStudentId,
        'Home',
        '1 Main St',
        'Halifax',
        'NS',
        'Canada',
        44.64,
        -63.57,
        'School',
        '99 School Rd',
        'Halifax',
        'NS',
        'Canada',
        44.65,
        -63.58,
      ],
    );
    approvedPickupId = Number(approvedAddresses.rows[0].id);
    approvedDropoffId = Number(approvedAddresses.rows[1].id);

    const pendingAddresses = await pool.query(
      `INSERT INTO addresses (
        driving_school_id, student_id, label, line1, city, province_or_state, country, latitude, longitude,
        is_default_pickup, is_default_dropoff, active
      ) VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,false,true),
        ($1,$2,$10,$11,$12,$13,$14,$15,$16,false,true,true)
      RETURNING id`,
      [
        schoolId,
        pendingStudentId,
        'Pending Home',
        '2 Main St',
        'Halifax',
        'NS',
        'Canada',
        44.66,
        -63.59,
        'Pending School',
        '3 Main St',
        'Halifax',
        'NS',
        'Canada',
        44.67,
        -63.6,
      ],
    );
    pendingPickupId = Number(pendingAddresses.rows[0].id);
    pendingDropoffId = Number(pendingAddresses.rows[1].id);
  }, 60000);

  afterAll(async () => {
    await closePool();
    await exec(`docker stop ${containerName}`);
  });

  it('returns available slots for a driver', async () => {
    const app = createApp();
    const response = await request(app)
      .get(`/schools/${schoolId}/drivers/${driverId}/available-slots`)
      .query({ date: '2099-01-01', pickupAddressId: approvedPickupId, dropoffAddressId: approvedDropoffId })
      .set('Authorization', 'Bearer emulator-token');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('blocks booking creation when licence is not approved', async () => {
    const app = createApp();
    const response = await request(app)
      .post(`/schools/${schoolId}/bookings`)
      .set('Authorization', 'Bearer emulator-token')
      .send({
        studentId: pendingStudentId,
        driverId,
        startTime: '2099-01-01T09:00:00.000Z',
        pickupAddressId: pendingPickupId,
        dropoffAddressId: pendingDropoffId,
      });

    expect(response.status).toBe(403);
  });

  it('creates, rejects conflicts, and cancels bookings respecting policies', async () => {
    const app = createApp();
    const createResponse = await request(app)
      .post(`/schools/${schoolId}/bookings`)
      .set('Authorization', 'Bearer emulator-token')
      .send({
        studentId: approvedStudentId,
        driverId,
        startTime: '2099-01-01T09:00:00.000Z',
        pickupAddressId: approvedPickupId,
        dropoffAddressId: approvedDropoffId,
      });

    expect(createResponse.status).toBe(201);
    const bookingId = createResponse.body.id as number;

    const conflictResponse = await request(app)
      .post(`/schools/${schoolId}/bookings`)
      .set('Authorization', 'Bearer emulator-token')
      .send({
        studentId: approvedStudentId,
        driverId,
        startTime: '2099-01-01T09:00:00.000Z',
        pickupAddressId: approvedPickupId,
        dropoffAddressId: approvedDropoffId,
      });

    expect(conflictResponse.status).toBe(409);

    const cancelResponse = await request(app)
      .post(`/schools/${schoolId}/bookings/${bookingId}/cancel`)
      .set('Authorization', 'Bearer emulator-token')
      .send({ reasonCode: 'student_request' });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.status).toBe('cancelled_by_school');
  });

  it('returns driver and student rosters for the school', async () => {
    const app = createApp();

    const driverResponse = await request(app)
      .get(`/schools/${schoolId}/drivers`)
      .set('Authorization', 'Bearer emulator-token');

    expect(driverResponse.status).toBe(200);
    expect(driverResponse.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: driverId })]));

    const studentResponse = await request(app)
      .get(`/schools/${schoolId}/students`)
      .set('Authorization', 'Bearer emulator-token');

    expect(studentResponse.status).toBe(200);
    expect(studentResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: approvedStudentId, licenceStatus: 'approved' }),
        expect.objectContaining({ id: pendingStudentId, licenceStatus: 'pending_review' }),
      ]),
    );
  });
});
