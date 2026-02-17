// Set process timezone to America/Halifax (AST/ADT with automatic DST)
process.env.TZ = 'America/Halifax';

import { createApp } from './app';
import { getPool } from './db';
import { startReminderScheduler } from './services/reminderScheduler';

const port = process.env.PORT || 3001;

// Ensure pool is configured on startup
getPool();

const app = createApp();

app.listen(port, () => {
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
