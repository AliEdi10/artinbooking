import { createApp } from './app';
import { getPool } from './db';

const port = process.env.PORT || 3001;

// Ensure pool is configured on startup
getPool();

const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);
});
