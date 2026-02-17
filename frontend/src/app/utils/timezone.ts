/**
 * Application timezone: America/Halifax (AST/ADT with automatic DST).
 * All date/time display should use this timezone for consistency.
 */
export const APP_TIMEZONE = 'America/Halifax';

/** Format a date for display: e.g. "2/18/2026, 9:00 AM" */
export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', { timeZone: APP_TIMEZONE });
}

/** Format date only: e.g. "2/18/2026" */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', { timeZone: APP_TIMEZONE });
}

/** Format time only: e.g. "09:00 AM" */
export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format date with custom options */
export function formatDateCustom(date: Date | string, options: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString('en-US', { timeZone: APP_TIMEZONE, ...options });
}

/** Get today's date as YYYY-MM-DD string in Halifax timezone */
export function todayDateString(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** Format time with custom options */
export function formatTimeCustom(date: Date | string, options: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleTimeString('en-US', { timeZone: APP_TIMEZONE, ...options });
}
