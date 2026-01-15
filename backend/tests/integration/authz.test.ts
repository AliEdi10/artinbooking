import { exec as execCb } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import util from 'util';
import request from 'supertest';
import { Pool, PoolConfig } from 'pg';
import { createApp } from '../../src/app';
import { closePool, getPool } from '../../src/db';
import { runMigrations } from '../../src/db/migrations';
import { issueLocalJwt } from '../../src/services/jwtIssuer';

const exec = util.promisify(execCb);

const dbConfig: PoolConfig = {
  host: '127.0.0.1',
  port: 55433,
  user: 'postgres',
  password: 'postgres',
  database: 'artinbk_authz_test',
};

const containerName = `artinbk-authz-${Date.now()}`;
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

describe('authentication and tenant enforcement', () => {
  let pool: Pool;
  let schoolAId: number;
  let schoolBId: number;

  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

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

    process.env.AUTH_EMULATOR = 'false';
    process.env.AUTH_LOCAL_JWT = 'true';
    process.env.AUTH_LOCAL_PRIVATE_KEY = privatePem;
    process.env.AUTH_LOCAL_ISSUER = 'local-authz-test';
    process.env.AUTH_LOCAL_AUDIENCE = 'artinbk-authz';
    process.env.AUTH_LOCAL_KEY_ID = 'local-key-test';
    process.env.AUTH_PROVIDER = 'local';

    pool = getPool(dbConfig);
    await runMigrations(pool, migrationsPath);

    const schoolInsert = await pool.query<{ id: number }>(
      `INSERT INTO driving_schools (name, city, province_or_state, country)
       VALUES ('School A', 'CityA', 'CA', 'Country'), ('School B', 'CityB', 'CB', 'Country')
       RETURNING id`,
    );

    schoolAId = schoolInsert.rows[0].id;
    schoolBId = schoolInsert.rows[1].id;

    await pool.query(
      `INSERT INTO users (driving_school_id, email, identity_provider, identity_subject, role, status)
       VALUES ($1, $2, 'local', 'superadmin-1', 'SUPERADMIN', 'active')`,
      [null, 'superadmin@example.com'],
    );

    await pool.query(
      `INSERT INTO users (driving_school_id, email, identity_provider, identity_subject, role, status)
       VALUES ($1, $2, 'local', 'admin-a', 'SCHOOL_ADMIN', 'active')`,
      [schoolAId, 'admin-a@example.com'],
    );

    await pool.query(
      `INSERT INTO users (driving_school_id, email, identity_provider, identity_subject, role, status)
       VALUES ($1, $2, 'local', 'admin-b', 'SCHOOL_ADMIN', 'active')`,
      [schoolBId, 'admin-b@example.com'],
    );

    await pool.query(
      `INSERT INTO users (driving_school_id, email, identity_provider, identity_subject, role, status)
       VALUES ($1, $2, 'local', 'driver-a', 'DRIVER', 'active')`,
      [schoolAId, 'driver-a@example.com'],
    );
  }, 60000);

  afterAll(async () => {
    await closePool();
    await exec(`docker stop ${containerName}`);
  });

  it('rejects requests without a bearer token', async () => {
    const app = createApp();
    const response = await request(app).get('/schools');

    expect(response.status).toBe(401);
  });

  it('rejects requests with an invalid token', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/schools')
      .set('Authorization', 'Bearer malformed');

    expect(response.status).toBe(401);
  });

  it('allows valid tokens and returns schools for superadmin', async () => {
    const token = issueLocalJwt({ sub: 'superadmin-1', email: 'superadmin@example.com' });
    const app = createApp();
    const response = await request(app)
      .get('/schools')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks cross-tenant access for school admins', async () => {
    const token = issueLocalJwt({ sub: 'admin-a', email: 'admin-a@example.com' });
    const app = createApp();
    const response = await request(app)
      .get(`/schools/${schoolBId}/drivers`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('enforces role restrictions on admin-only routes', async () => {
    const token = issueLocalJwt({ sub: 'driver-a', email: 'driver-a@example.com' });
    const app = createApp();
    const response = await request(app)
      .post(`/schools/${schoolAId}/students`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: 999, fullName: 'Test Student' });

    expect(response.status).toBe(403);
  });
});
