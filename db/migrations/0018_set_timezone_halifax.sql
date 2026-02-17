-- Set database timezone to America/Halifax (AST/ADT with automatic DST)
-- This affects NOW(), CURRENT_DATE, CURRENT_TIMESTAMP, date_trunc(), etc.
ALTER DATABASE artinbk SET timezone = 'America/Halifax';

-- Also set it for the current session so it takes effect immediately
SET timezone = 'America/Halifax';
