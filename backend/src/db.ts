import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;

const DEFAULT_POOL_MAX = 10;

export function buildPoolConfig(overrides: Partial<PoolConfig> = {}): PoolConfig {
  const max = process.env.PGPOOL_MAX ? Number(process.env.PGPOOL_MAX) : DEFAULT_POOL_MAX;
  const port = process.env.PGPORT ? Number(process.env.PGPORT) : 5432;

  return {
    host: process.env.PGHOST || 'localhost',
    port,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'artinbk',
    ssl: process.env.PGSSL === 'true',
    max,
    ...overrides,
  };
}

export function getPool(config?: PoolConfig): Pool {
  if (!pool) {
    pool = new Pool(config ?? buildPoolConfig());
  }
  return pool;
}

export function resetPool() {
  pool = null;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    resetPool();
  }
}

export async function query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

