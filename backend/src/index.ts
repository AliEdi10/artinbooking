// Set process timezone to America/Halifax (AST/ADT with automatic DST)
process.env.TZ = 'America/Halifax';

import { createApp } from './app';
import { getPool, closePool } from './db';
import { startReminderScheduler } from './services/reminderScheduler';

const port = process.env.PORT || 3001;

// Ensure pool is configured on startup
getPool();

const app = createApp();

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);

  // Start the lesson reminder scheduler
  // Only start in production or if explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_REMINDER_SCHEDULER === 'true') {
    startReminderScheduler();
  } else {
    console.log('ℹ️ Reminder scheduler disabled (set ENABLE_REMINDER_SCHEDULER=true to enable)');
  }
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await closePool();
    console.log('Server closed');
    process.exit(0);
  });
  // Force exit after 10 seconds if connections don't drain
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
