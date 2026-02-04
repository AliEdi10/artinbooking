'use client';

import React, { useMemo, useState } from 'react';

type Availability = { id: number; date: string; startTime: string; endTime: string; type?: string };
type Booking = { id: number; driverId: number; studentId: number; startTime: string; status: string };
type StudentProfile = { id: number; fullName: string };
type BlockedDate = { date: string; reason?: string };

interface WeeklyCalendarProps {
    availability: Availability[];
    bookings: Booking[];
    students: StudentProfile[];
    blockedDates?: BlockedDate[];
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7 AM to 6 PM
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(baseDate: Date): Date[] {
    const monday = new Date(baseDate);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return date;
    });
}

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + minutes / 60;
}

export function WeeklyCalendar({ availability, bookings, students, blockedDates = [] }: WeeklyCalendarProps) {
    const [weekOffset, setWeekOffset] = useState(0);

    const baseDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() + weekOffset * 7);
        return date;
    }, [weekOffset]);

    const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);

    // Get blocked day indices for this week
    const blockedDayIndices = useMemo(() => {
        const indices: Set<number> = new Set();

        // Check blockedDates prop
        blockedDates.forEach((blocked) => {
            const blockedDateStr = blocked.date.split('T')[0];
            const dayIndex = weekDates.findIndex(d => formatDate(d) === blockedDateStr);
            if (dayIndex !== -1) indices.add(dayIndex);
        });

        // Also check availability for override_closed type
        availability.forEach((slot) => {
            if (slot.type === 'override_closed') {
                const slotDate = slot.date.split('T')[0];
                const dayIndex = weekDates.findIndex(d => formatDate(d) === slotDate);
                if (dayIndex !== -1) indices.add(dayIndex);
            }
        });

        return indices;
    }, [blockedDates, availability, weekDates]);

    // Map availability to grid positions (excluding blocked/off days)
    const availabilityBlocks = useMemo(() => {
        const blocks: { dayIndex: number; startHour: number; endHour: number; label: string }[] = [];

        availability.forEach((slot) => {
            // Skip off-days - they're shown separately
            if (slot.type === 'override_closed') return;

            const slotDate = slot.date.split('T')[0];
            const dayIndex = weekDates.findIndex(d => formatDate(d) === slotDate);
            if (dayIndex === -1) return;

            const startHour = parseTime(slot.startTime);
            const endHour = parseTime(slot.endTime);

            blocks.push({
                dayIndex,
                startHour,
                endHour,
                label: `${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)}`,
            });
        });

        return blocks;
    }, [availability, weekDates]);

    // Map bookings to grid positions
    const bookingBlocks = useMemo(() => {
        const blocks: { dayIndex: number; startHour: number; endHour: number; studentName: string; status: string }[] = [];

        bookings.forEach((booking) => {
            const bookingDate = new Date(booking.startTime);
            const slotDate = formatDate(bookingDate);
            const dayIndex = weekDates.findIndex(d => formatDate(d) === slotDate);
            if (dayIndex === -1) return;

            const startHour = bookingDate.getHours() + bookingDate.getMinutes() / 60;
            const endHour = startHour + 1; // Assume 1 hour lessons

            const student = students.find(s => s.id === booking.studentId);

            blocks.push({
                dayIndex,
                startHour,
                endHour,
                studentName: student?.fullName ?? 'Student',
                status: booking.status,
            });
        });

        return blocks;
    }, [bookings, weekDates, students]);

    const weekLabel = useMemo(() => {
        const start = weekDates[0];
        const end = weekDates[6];
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }, [weekDates]);

    return (
        <div className="space-y-3">
            {/* Week Navigation */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setWeekOffset(w => w - 1)}
                    className="px-3 py-1 text-sm rounded border text-slate-700 hover:bg-slate-100"
                >
                    ← Previous
                </button>
                <span className="text-sm font-medium text-slate-800">{weekLabel}</span>
                <button
                    onClick={() => setWeekOffset(w => w + 1)}
                    className="px-3 py-1 text-sm rounded border text-slate-700 hover:bg-slate-100"
                >
                    Next →
                </button>
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-xs text-slate-700">
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
                    <span className="text-slate-700">Available</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-blue-500 rounded" />
                    <span className="text-slate-700">Booked Lesson</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
                    <span className="text-slate-700">Off-Day / Blocked</span>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Header */}
                    <div className="grid grid-cols-8 gap-px bg-slate-200 rounded-t">
                        <div className="bg-white p-2 text-xs font-medium text-slate-700">Time</div>
                        {weekDates.map((date, i) => (
                            <div key={i} className="bg-white p-2 text-center">
                                <div className="text-xs font-medium">{DAYS[i]}</div>
                                <div className="text-xs text-slate-700">{date.getDate()}</div>
                            </div>
                        ))}
                    </div>

                    {/* Time Grid */}
                    <div className="relative bg-slate-100">
                        {HOURS.map((hour) => (
                            <div key={hour} className="grid grid-cols-8 gap-px h-12">
                                <div className="bg-white p-1 text-xs text-slate-700 flex items-start">
                                    {hour}:00
                                </div>
                                {weekDates.map((_, dayIndex) => (
                                    <div key={dayIndex} className="bg-white relative" />
                                ))}
                            </div>
                        ))}

                        {/* Blocked/Off-Day Overlays */}
                        {Array.from(blockedDayIndices).map((dayIndex) => {
                            const left = `calc(${(dayIndex + 1) * 12.5}% + 1px)`;
                            const totalHeight = HOURS.length * 48; // Full day height

                            return (
                                <div
                                    key={`blocked-${dayIndex}`}
                                    className="absolute bg-red-100 border border-red-200 rounded text-xs flex items-center justify-center"
                                    style={{
                                        top: '0px',
                                        height: `${totalHeight}px`,
                                        left,
                                        width: 'calc(12.5% - 2px)',
                                        zIndex: 0,
                                    }}
                                    title="Off-Day / Blocked"
                                >
                                    <span className="text-red-600 font-medium rotate-90">Off-Day</span>
                                </div>
                            );
                        })}

                        {/* Availability Blocks */}
                        {availabilityBlocks.map((block, i) => {
                            const top = (block.startHour - 7) * 48; // 48px per hour
                            const height = (block.endHour - block.startHour) * 48;
                            const left = `calc(${(block.dayIndex + 1) * 12.5}% + 1px)`;

                            return (
                                <div
                                    key={`avail-${i}`}
                                    className="absolute bg-green-100 border border-green-300 rounded text-xs p-1 overflow-hidden"
                                    style={{
                                        top: `${top}px`,
                                        height: `${height}px`,
                                        left,
                                        width: 'calc(12.5% - 2px)',
                                        zIndex: 1,
                                    }}
                                    title={`Available: ${block.label}`}
                                >
                                    <span className="text-green-700 font-medium">Available</span>
                                </div>
                            );
                        })}

                        {/* Booking Blocks */}
                        {bookingBlocks.map((block, i) => {
                            const top = (block.startHour - 7) * 48;
                            const height = Math.max((block.endHour - block.startHour) * 48, 24);
                            const left = `calc(${(block.dayIndex + 1) * 12.5}% + 1px)`;

                            return (
                                <div
                                    key={`booking-${i}`}
                                    className="absolute bg-blue-500 text-white rounded text-xs p-1 overflow-hidden shadow"
                                    style={{
                                        top: `${top}px`,
                                        height: `${height}px`,
                                        left,
                                        width: 'calc(12.5% - 2px)',
                                        zIndex: 2,
                                    }}
                                    title={`Lesson with ${block.studentName}`}
                                >
                                    <div className="font-medium truncate">{block.studentName}</div>
                                    <div className="text-[10px] opacity-80">{block.status}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
