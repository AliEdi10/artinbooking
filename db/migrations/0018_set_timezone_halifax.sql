-- Set database timezone to America/Halifax (AST/ADT with automatic DST)
-- This affects NOW(), CURRENT_DATE, CURRENT_TIMESTAMP, date_trunc(), etc.
-- NOTE: ALTER DATABASE requires the actual DB name. On Railway it's "railway".
-- Run manually: ALTER DATABASE railway SET timezone = 'America/Halifax';

-- Set it for the current session so it takes effect immediately
SET timezone = 'America/Halifax';
