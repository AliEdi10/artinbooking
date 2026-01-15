import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { getPool } from '../db';

export async function runMigrations(pool: Pool | undefined = undefined, migrationsDir?: string) {
  const activePool = pool ?? getPool();
  const migrationsPath =
    migrationsDir || process.env.MIGRATIONS_DIR || path.resolve(process.cwd(), '..', 'db', 'migrations');

  const entries = await fs.readdir(migrationsPath);
  const migrationFiles = entries
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of migrationFiles) {
    const fullPath = path.join(migrationsPath, file);
    const sql = await fs.readFile(fullPath, 'utf8');
    await activePool.query(sql);
  }
}
