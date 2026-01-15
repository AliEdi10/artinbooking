import path from 'path';
import { runMigrations } from '../db/migrations';
import { closePool } from '../db';

async function main() {
  const migrationsDir = process.env.MIGRATIONS_DIR || path.resolve(process.cwd(), '..', 'db', 'migrations');
  await runMigrations(undefined, migrationsDir);
  // eslint-disable-next-line no-console
  console.log('Migrations applied from', migrationsDir);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
