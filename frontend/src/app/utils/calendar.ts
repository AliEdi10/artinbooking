/**
 * Utility functions for generating iCalendar (.ics) files
 * Compatible with Google Calendar, Apple Calendar, Outlook, etc.
 */

export interface CalendarEvent {
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    organizer?: {
        name: string;
        email?: string;
    };
}

/**
 * Format a date to iCalendar format (YYYYMMDDTHHMMSSZ)
 */
function formatDateToICS(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');

    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate a unique identifier for the calendar event
 */
function generateUID(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@artinbk.com`;
}

/**
 * Escape special characters in iCalendar text
 */
function escapeICSText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/**
 * Generate iCalendar (.ics) file content
 */
export function generateICSContent(event: CalendarEvent): string {
    const now = new Date();

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Artinbk Driving School//Booking System//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${generateUID()}`,
        `DTSTAMP:${formatDateToICS(now)}`,
        `DTSTART:${formatDateToICS(event.startTime)}`,
        `DTEND:${formatDateToICS(event.endTime)}`,
        `SUMMARY:${escapeICSText(event.title)}`,
    ];

    if (event.description) {
        lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
    }

    if (event.location) {
        lines.push(`LOCATION:${escapeICSText(event.location)}`);
    }

    if (event.organizer) {
        const organizerLine = event.organizer.email
            ? `ORGANIZER;CN=${escapeICSText(event.organizer.name)}:mailto:${event.organizer.email}`
            : `ORGANIZER;CN=${escapeICSText(event.organizer.name)}:`;
        lines.push(organizerLine);
    }

    // Add reminder 1 hour before
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT1H');
    lines.push('ACTION:DISPLAY');
    lines.push('DESCRIPTION:Driving Lesson Reminder');
    lines.push('END:VALARM');

    // Add reminder 24 hours before
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT24H');
    lines.push('ACTION:DISPLAY');
    lines.push('DESCRIPTION:Driving Lesson Tomorrow');
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');

    return lines.join('\r\n');
}

/**
 * Download an iCalendar file
 */
export function downloadICSFile(event: CalendarEvent, filename?: string): void {
    const content = generateICSContent(event);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `driving-lesson-${formatDateToICS(event.startTime).slice(0, 8)}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * Create a calendar event for a driving lesson (student perspective)
 */
export function createStudentLessonEvent(
    driverName: string,
    startTime: Date,
    endTime: Date,
    pickupAddress?: string,
    dropoffAddress?: string
): CalendarEvent {
    let description = `Driving lesson with ${driverName}`;
    if (pickupAddress) {
        description += `\n\nPickup: ${pickupAddress}`;
    }
    if (dropoffAddress) {
        description += `\nDropoff: ${dropoffAddress}`;
    }

    return {
        title: `🚗 Driving Lesson with ${driverName}`,
        description,
        location: pickupAddress,
        startTime,
        endTime,
        organizer: {
            name: driverName,
        },
    };
}

/**
 * Create a calendar event for a driving lesson (driver perspective)
 */
export function createDriverLessonEvent(
    studentName: string,
    startTime: Date,
    endTime: Date,
    pickupAddress?: string,
    dropoffAddress?: string
): CalendarEvent {
    let description = `Driving lesson with ${studentName}`;
    if (pickupAddress) {
        description += `\n\nPickup: ${pickupAddress}`;
    }
    if (dropoffAddress) {
        description += `\nDropoff: ${dropoffAddress}`;
    }

    return {
        title: `🚗 Lesson: ${studentName}`,
        description,
        location: pickupAddress,
        startTime,
        endTime,
    };
}

/**
 * Generate Google Calendar URL for adding event
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
    const formatGoogleDate = (date: Date) => {
        return date.toISOString().replace(/-|:|\.\d{3}/g, '');
    };

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${formatGoogleDate(event.startTime)}/${formatGoogleDate(event.endTime)}`,
    });

    if (event.description) {
        params.set('details', event.description);
    }

    if (event.location) {
        params.set('location', event.location);
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
