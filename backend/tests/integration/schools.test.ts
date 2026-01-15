import { exec as execCb } from 'child_process';
import path from 'path';
import util from 'util';
import request from 'supertest';
import { Pool, PoolConfig } from 'pg';
import { createApp } from '../../src/app';
import { getPool, closePool } from '../../src/db';
import { runMigrations } from '../../src/db/migrations';
import { loadUserByIdentity } from '../../src/repositories/users';

const exec = util.promisify(execCb);

const dbConfig: PoolConfig = {
  host: '127.0.0.1',
  port: 55432,
  user: 'postgres',
  password: 'postgres',
  database: 'artinbk_test',
};

const containerName = `artinbk-test-${Date.now()}`;
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

describe('GET /schools', () => {
  let pool: Pool;

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

    await pool.query(
      `INSERT INTO users (email, identity_provider, identity_subject, role, status)
       VALUES ($1, $2, $3, 'SUPERADMIN', 'active')`,
      ['superadmin@example.com', 'emulated', 'superadmin-emulated'],
    );

    await pool.query(
      `INSERT INTO driving_schools (name, city, province_or_state, country)
       VALUES ($1, $2, $3, $4)`
        .replace(/\n/g, ' '),
      ['Artin Driving School - Test', 'Halifax', 'NS', 'Canada'],
    );
  }, 60000);

  afterAll(async () => {
    await closePool();
    await exec(`docker stop ${containerName}`);
  });

  it('returns rows from the driving_schools table', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/schools')
      .set('Authorization', 'Bearer emulator-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Artin Driving School - Test',
          city: 'Halifax',
          provinceOrState: 'NS',
        }),
      ]),
    );
  });

  it('applies migrations without errors', async () => {
    const result = await pool.query("SELECT to_regclass('public.driving_schools') as table_name");
    expect(result.rows[0].table_name).toBe('driving_schools');
  });

  it('loads users by identity sub when present', async () => {
    await pool.query(
      `INSERT INTO users (email, identity_provider, identity_subject, role, status)
       VALUES ($1, $2, $3, 'SCHOOL_ADMIN', 'active')`,
      ['lookup@example.com', 'google', 'lookup-subject'],
    );

    const user = await loadUserByIdentity('lookup-subject', 'lookup@example.com');
    expect(user?.email).toBe('lookup@example.com');
    expect(user?.identitySubject).toBe('lookup-subject');
  });

  it('creates and accepts an invitation with the authenticated identity', async () => {
    const app = createApp();

    const createInvitation = await request(app)
      .post('/schools/1/invitations')
      .set('Authorization', 'Bearer emulator-token')
      .send({ email: 'new-admin@example.com', role: 'SCHOOL_ADMIN', expiresInDays: 1 });

    expect(createInvitation.status).toBe(201);
    const token = createInvitation.body.invitation.token as string;

    const acceptResponse = await request(app)
      .post('/invitations/accept')
      .set('Authorization', 'Bearer emulator-token')
      .set('x-test-user-email', 'new-admin@example.com')
      .set('x-test-user-sub', 'new-admin-subject')
      .send({ token });

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.user.role).toBe('SCHOOL_ADMIN');
    expect(acceptResponse.body.invitation.acceptedAt).toBeTruthy();
  });
});
