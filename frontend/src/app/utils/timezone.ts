/**
 * Application timezone: America/Halifax (AST/ADT with automatic DST).
 * All date/time display should use this timezone for consistency.
 */
export const APP_TIMEZONE = 'America/Halifax';

/**
 * Safely parse a date value. Bare YYYY-MM-DD strings (no time component)
 * are parsed as local time to avoid UTC-midnight date shift.
 */
function safeDate(date: Date | string): Date {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(date + 'T00:00:00');
  }
  return new Date(date);
}

/** Format a date for display: e.g. "2/18/2026, 9:00 AM" */
export function formatDateTime(date: Date | string): string {
  return safeDate(date).toLocaleString('en-US', { timeZone: APP_TIMEZONE });
}

/** Format date only: e.g. "2/18/2026" */
export function formatDate(date: Date | string): string {
  return safeDate(date).toLocaleDateString('en-US', { timeZone: APP_TIMEZONE });
}

/** Format time only: e.g. "09:00 AM" */
export function formatTime(date: Date | string): string {
  return safeDate(date).toLocaleTimeString('en-US', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format date with custom options */
export function formatDateCustom(date: Date | string, options: Intl.DateTimeFormatOptions): string {
  return safeDate(date).toLocaleDateString('en-US', { timeZone: APP_TIMEZONE, ...options });
}

/** Get any date as YYYY-MM-DD string in Halifax timezone */
export function toDateStringHalifax(date: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(safeDate(date));
}

/** Get today's date as YYYY-MM-DD string in Halifax timezone */
export function todayDateString(): string {
  return toDateStringHalifax(new Date());
}

/** Format time with custom options */
export function formatTimeCustom(date: Date | string, options: Intl.DateTimeFormatOptions): string {
  return safeDate(date).toLocaleTimeString('en-US', { timeZone: APP_TIMEZONE, ...options });
}
