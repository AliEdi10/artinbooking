'use client';

import React, { useMemo, useState } from 'react';

type Availability = { id: number; date: string; startTime: string; endTime: string; type?: string };
type Booking = { id: number; driverId: number; studentId: number; startTime: string; status: string };
type StudentProfile = { id: number; fullName: string };

interface WeeklyCalendarProps {
    availability: Availability[];
    bookings: Booking[];
    students: StudentProfile[];
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

export function WeeklyCalendar({ availability, bookings, students }: WeeklyCalendarProps) {
    const [weekOffset, setWeekOffset] = useState(0);

    const baseDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() + weekOffset * 7);
        return date;
    }, [weekOffset]);

    const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);

    // Map availability to grid positions - split by type
    const { workingBlocks, closedBlocks } = useMemo(() => {
        const working: { dayIndex: number; startHour: number; endHour: number; label: string }[] = [];
        const closed: { dayIndex: number; startHour: number; endHour: number; label: string }[] = [];

        availability.forEach((slot) => {
            const slotDate = slot.date.split('T')[0];
            const dayIndex = weekDates.findIndex(d => formatDate(d) === slotDate);
            if (dayIndex === -1) return;

            const startHour = parseTime(slot.startTime);
            const endHour = parseTime(slot.endTime);

            const block = {
                dayIndex,
                startHour,
                endHour,
                label: `${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)}`,
            };

            if (slot.type === 'override_closed') {
                closed.push(block);
            } else {
                working.push(block);
            }
        });

        return { workingBlocks: working, closedBlocks: closed };
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
                    <span className="text-slate-700">Blocked / Off Day</span>
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

                        {/* Availability Blocks (green) */}
                        {workingBlocks.map((block, i) => {
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

                        {/* Blocked / Off-Day Blocks (red) */}
                        {closedBlocks.map((block, i) => {
                            const top = (block.startHour - 7) * 48;
                            const height = Math.max((block.endHour - block.startHour) * 48, 24);
                            const left = `calc(${(block.dayIndex + 1) * 12.5}% + 1px)`;

                            return (
                                <div
                                    key={`closed-${i}`}
                                    className="absolute bg-red-100 border border-red-300 rounded text-xs p-1 overflow-hidden"
                                    style={{
                                        top: `${top}px`,
                                        height: `${height}px`,
                                        left,
                                        width: 'calc(12.5% - 2px)',
                                        zIndex: 1,
                                    }}
                                    title={`Blocked: ${block.label}`}
                                >
                                    <span className="text-red-700 font-medium">Off Day</span>
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
