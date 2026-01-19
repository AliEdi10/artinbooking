'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useMemo, useState } from 'react';
import { Protected } from '../auth/Protected';
import { AppShell } from '../components/AppShell';
import { SummaryCard } from '../components/SummaryCard';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { MapViewer } from '../components/MapViewer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../apiClient';

type DriverProfile = { id: number; fullName: string; active: boolean };
type Availability = { id: number; date: string; startTime: string; endTime: string; type?: string };
type Booking = { id: number; driverId: number; studentId: number; startTime: string; status: string; pickupAddressId?: number | null; dropoffAddressId?: number | null };
type StudentProfile = { id: number; fullName: string };
type Address = { id: number; latitude: number | null; longitude: number | null; label: string; line1: string; city: string };

type AvailabilityForm = { date: string; startTime: string; endTime: string };

type DriverState = {
  driver: DriverProfile | null;
  availability: Availability[];
  bookings: Booking[];
  pastBookings: Booking[];
  students: StudentProfile[];
};

export default function DriverPage() {
  const { token, user } = useAuth();
  const schoolId = useMemo(() => user?.schoolId, [user?.schoolId]);

  const [driverState, setDriverState] = useState<DriverState>({
    driver: null,
    availability: [],
    bookings: [],
    pastBookings: [],
    students: [],
  });
  const [status, setStatus] = useState<string>('Loading driver data...');
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityForm>({ date: '', startTime: '', endTime: '' });
  const [reschedule, setReschedule] = useState<Record<number, string>>({});
  const [cancelReason, setCancelReason] = useState<Record<number, string>>({});
  const [actionMessage, setActionMessage] = useState('');
  const [holidayDate, setHolidayDate] = useState('');

  // Phase 3: Student history viewer
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentHistory, setStudentHistory] = useState<Booking[]>([]);
  const [studentUsage, setStudentUsage] = useState<{ usedHours: number; allowedHours: number | null } | null>(null);

  // Phase 4: Confirmation dialog state
  const [confirmCancel, setConfirmCancel] = useState<{ bookingId: number; studentName: string } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const availabilitySummary = driverState.availability.map((slot) => ({
    day: new Date(slot.date).toLocaleDateString(),
    window: `${slot.startTime}–${slot.endTime}`,
  }));

  const upcomingLessons = driverState.bookings.map((booking) => ({
    time: new Date(booking.startTime).toLocaleString(),
    status: booking.status,
    id: booking.id,
    student: driverState.students.find((student) => student.id === booking.studentId)?.fullName ?? 'Student',
  }));

  async function loadDriverContext() {
    if (!token || !schoolId) return;
    setStatus('Loading driver roster...');

    try {
      const drivers = await apiFetch<DriverProfile[]>(`/schools/${schoolId}/drivers`, token);
      const activeDriver = drivers.find((entry) => entry.active) ?? drivers[0] ?? null;
      setDriverState((prev) => ({ ...prev, driver: activeDriver ?? null }));
      if (!activeDriver) {
        setStatus('No driver profile found for this account.');
        return;
      }
      setStatus('Loading availability and bookings...');

      const [availabilityResults, upcomingResults, pastResults, studentResults] = await Promise.all([
        apiFetch<Availability[]>(`/schools/${schoolId}/drivers/${activeDriver.id}/availability`, token).catch(() => []),
        apiFetch<Booking[]>(`/schools/${schoolId}/bookings?status=upcoming`, token).catch(() => []),
        apiFetch<Booking[]>(`/schools/${schoolId}/bookings?status=past`, token).catch(() => []),
        apiFetch<StudentProfile[]>(`/schools/${schoolId}/students`, token).catch(() => []),
      ]);

      setDriverState({
        driver: activeDriver,
        availability: availabilityResults,
        bookings: upcomingResults.filter((booking) => booking.driverId === activeDriver.id),
        pastBookings: pastResults.filter((booking) => booking.driverId === activeDriver.id),
        students: studentResults,
      });
      setStatus('');
    } catch (err) {
      setStatus('Unable to load driver profile. Check your token and backend availability.');
    }
  }

  useEffect(() => {
    loadDriverContext();
  }, [schoolId, token]);

  // Phase 3: Load selected student's history
  async function loadStudentHistory(studentId: number) {
    if (!token || !schoolId) return;
    setSelectedStudentId(studentId);
    try {
      const [bookingsResult, usageResult] = await Promise.all([
        apiFetch<Booking[]>(`/schools/${schoolId}/bookings?studentId=${studentId}`, token).catch(() => []),
        apiFetch<{ usedHours: number; allowedHours: number | null }>(
          `/schools/${schoolId}/students/${studentId}/usage`,
          token
        ).catch(() => null),
      ]);
      setStudentHistory(bookingsResult);
      setStudentUsage(usageResult);
    } catch (err) {
      console.error('Unable to load student history');
    }
  }

  async function publishAvailability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId || !driverState.driver) return;
    setActionMessage('Publishing availability...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}/availability`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: availabilityForm.date,
          startTime: availabilityForm.startTime,
          endTime: availabilityForm.endTime,
          type: 'working_hours',
        }),
      });
      setAvailabilityForm({ date: '', startTime: '', endTime: '' });
      await loadDriverContext();
      setActionMessage('Availability published.');
    } catch (err) {
      setActionMessage('Unable to publish availability.');
    }
  }

  async function addHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId || !driverState.driver || !holidayDate) return;
    setActionMessage('Adding time off...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}/availability`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: holidayDate,
          startTime: '00:00',
          endTime: '23:59',
          type: 'override_closed',
        }),
      });
      setHolidayDate('');
      await loadDriverContext();
      setActionMessage('Time off added.');
    } catch (err) {
      setActionMessage('Unable to add time off.');
    }
  }

  async function removeHoliday(availabilityId: number) {
    if (!token || !schoolId || !driverState.driver) return;
    setActionMessage('Removing time off...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}/availability/${availabilityId}`, token, {
        method: 'DELETE',
      });
      await loadDriverContext();
      setActionMessage('Time off removed.');
    } catch (err) {
      setActionMessage('Unable to remove time off.');
    }
  }

  async function updateBooking(bookingId: number, newStart: string) {
    if (!token || !schoolId || !newStart) return;
    setActionMessage('Updating booking...');
    try {
      await apiFetch(`/schools/${schoolId}/bookings/${bookingId}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: new Date(newStart).toISOString() }),
      });
      setReschedule((prev) => ({ ...prev, [bookingId]: '' }));
      await loadDriverContext();
      setActionMessage('Booking rescheduled.');
    } catch (err) {
      setActionMessage('Unable to reschedule booking.');
    }
  }

  async function cancelBooking(bookingId: number) {
    if (!token || !schoolId) return;
    setIsCancelling(true);
    try {
      await apiFetch(`/schools/${schoolId}/bookings/${bookingId}/cancel`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode: cancelReason[bookingId] || undefined }),
      });
      setCancelReason((prev) => ({ ...prev, [bookingId]: '' }));
      await loadDriverContext();
      setActionMessage('Booking cancelled.');
    } catch (err) {
      setActionMessage('Unable to cancel booking.');
    } finally {
      setIsCancelling(false);
      setConfirmCancel(null);
    }
  }

  async function markCompleted(bookingId: number) {
    if (!token || !schoolId) return;
    setActionMessage('Marking lesson as completed...');
    try {
      await apiFetch(`/schools/${schoolId}/bookings/${bookingId}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      await loadDriverContext();
      setActionMessage('Lesson marked as completed!');
    } catch (err) {
      setActionMessage('Unable to mark lesson as completed.');
    }
  }

  return (
    <Protected allowedRoles={['driver', 'school_admin', 'superadmin']}>
      <AppShell>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Driver schedule & availability</h1>
            <p className="text-sm text-slate-700">
              Adjust your service hours, review requests, and keep bookings within buffers and travel radius.
            </p>
            <p className="text-xs text-slate-700">
              {driverState.driver ? `Active profile: ${driverState.driver.fullName}` : 'No driver profile loaded yet.'}
            </p>
            {actionMessage ? <p className="text-[11px] text-slate-700">{actionMessage}</p> : null}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SummaryCard
              title="Availability grid"
              description="Snapshot of 15-minute grid availability derived from your working hours."
              footer={status || 'Loaded from /drivers/:id/availability'}
            >
              <ul className="space-y-1 text-sm text-slate-700">
                {availabilitySummary.map((slot) => (
                  <li key={`${slot.day}-${slot.window}`} className="flex justify-between">
                    <span>{slot.day}</span>
                    <span className="text-xs text-slate-700">{slot.window}</span>
                  </li>
                ))}
                {availabilitySummary.length === 0 && !status ? (
                  <li className="text-xs text-slate-700">No availability published yet.</li>
                ) : null}
              </ul>
            </SummaryCard>
            <SummaryCard
              title="Upcoming lessons"
              description="Displays bookings already screened for buffers, travel caps, and service radius."
              footer={status || 'Loaded from /schools/:id/bookings'}
            >
              <ul className="space-y-1 text-sm text-slate-700">
                {upcomingLessons.map((lesson) => (
                  <li key={`${lesson.id}-${lesson.time}`} className="space-y-1 border rounded p-2 bg-slate-50">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{lesson.time}</p>
                        <p className="text-xs text-slate-700">{lesson.status}</p>
                        <p className="text-[11px] text-slate-700">Student: {lesson.student}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs items-center">
                      <input
                        className="border rounded px-2 py-1"
                        type="datetime-local"
                        value={reschedule[lesson.id] ?? ''}
                        onChange={(e) => setReschedule((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                        placeholder="New start time"
                      />
                      <button
                        className="px-3 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100"
                        onClick={() => updateBooking(lesson.id, reschedule[lesson.id])}
                        type="button"
                        disabled={!reschedule[lesson.id]}
                      >
                        Reschedule
                      </button>
                      <input
                        className="border rounded px-2 py-1"
                        placeholder="Cancel reason"
                        value={cancelReason[lesson.id] ?? ''}
                        onChange={(e) => setCancelReason((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                      />
                      <button
                        className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-500"
                        type="button"
                        onClick={() => setConfirmCancel({ bookingId: lesson.id, studentName: lesson.student })}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-500"
                        type="button"
                        onClick={() => markCompleted(lesson.id)}
                      >
                        ✓ Completed
                      </button>
                    </div>
                  </li>
                ))}
                {upcomingLessons.length === 0 && !status ? (
                  <li className="text-xs text-slate-700">No bookings scheduled yet.</li>
                ) : null}
              </ul>
            </SummaryCard>
          </div>

          {/* Weekly Calendar View */}
          <SummaryCard
            title="Weekly Schedule"
            description="Visual calendar showing your availability and booked lessons."
          >
            <WeeklyCalendar
              availability={driverState.availability}
              bookings={driverState.bookings}
              students={driverState.students}
            />
          </SummaryCard>

          {/* Phase 3: Student History Viewer */}
          <SummaryCard
            title="👤 Student History"
            description="Select a student to view their complete lesson history and usage."
            footer={selectedStudentId ? `Viewing student ID ${selectedStudentId}` : 'Select a student above'}
          >
            <div className="space-y-3">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={selectedStudentId ?? ''}
                onChange={(e) => e.target.value && loadStudentHistory(Number(e.target.value))}
              >
                <option value="">-- Select a student --</option>
                {driverState.students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </select>

              {selectedStudentId && studentUsage && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-sm font-medium text-blue-800">📊 Usage Statistics</p>
                  <p className="text-xs text-slate-700">
                    Hours Used: <strong>{studentUsage.usedHours.toFixed(1)}</strong>
                    {studentUsage.allowedHours && ` / ${studentUsage.allowedHours} allowed`}
                  </p>
                </div>
              )}

              {selectedStudentId && (
                <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
                  {studentHistory.map((booking) => (
                    <li key={booking.id} className="border rounded p-2 bg-slate-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{new Date(booking.startTime).toLocaleDateString()}</p>
                          <p className="text-xs text-slate-700">
                            {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${booking.status === 'completed' ? 'bg-green-100 text-green-800'
                          : booking.status === 'scheduled' ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                          }`}>
                          {booking.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </li>
                  ))}
                  {studentHistory.length === 0 && (
                    <li className="text-xs text-slate-700 text-center py-4">No lesson history for this student.</li>
                  )}
                </ul>
              )}

              {!selectedStudentId && (
                <p className="text-xs text-slate-700 text-center py-4">
                  Select a student from the dropdown to view their lesson history.
                </p>
              )}
            </div>
          </SummaryCard>
          <SummaryCard
            title="Actions"
            description="These controls will call backend endpoints to update availability and handle booking decisions."
          >
            <form className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm" onSubmit={publishAvailability}>
              <input
                className="border rounded px-2 py-2"
                type="date"
                value={availabilityForm.date}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, date: e.target.value })}
                required
              />
              <input
                className="border rounded px-2 py-2"
                type="time"
                value={availabilityForm.startTime}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, startTime: e.target.value })}
                required
              />
              <input
                className="border rounded px-2 py-2"
                type="time"
                value={availabilityForm.endTime}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, endTime: e.target.value })}
                required
              />
              <button className="px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800" type="submit">
                Publish availability
              </button>
            </form>
          </SummaryCard>
          <SummaryCard
            title="Time Off / Holidays"
            description="Mark days you're unavailable. Students won't be able to book on these dates."
            footer={`${driverState.availability.filter(a => a.type === 'override_closed').length} day(s) blocked`}
          >
            <form className="flex gap-2 mb-3" onSubmit={addHoliday}>
              <input
                className="border rounded px-3 py-2 flex-1 text-sm"
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                required
                min={new Date().toISOString().slice(0, 10)}
              />
              <button
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
                type="submit"
              >
                Block Date
              </button>
            </form>
            <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
              {driverState.availability
                .filter(a => a.type === 'override_closed')
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((holiday) => (
                  <li key={holiday.id} className="flex justify-between items-center border rounded p-2 bg-red-50">
                    <div>
                      <span className="font-medium">{new Date(holiday.date).toLocaleDateString()}</span>
                      <span className="text-xs text-red-600 ml-2">⛔ Unavailable</span>
                    </div>
                    <button
                      className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300"
                      onClick={() => removeHoliday(holiday.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              {driverState.availability.filter(a => a.type === 'override_closed').length === 0 ? (
                <li className="text-xs text-slate-700 text-center py-2">No time off scheduled.</li>
              ) : null}
            </ul>
          </SummaryCard>
          <SummaryCard
            title="Lesson History"
            description="Your completed and cancelled lessons."
            footer={`${driverState.pastBookings.length} past lesson(s)`}
          >
            <ul className="space-y-2 text-sm text-slate-700 max-h-64 overflow-y-auto">
              {driverState.pastBookings.map((booking) => (
                <li key={booking.id} className="border rounded p-3 bg-slate-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{new Date(booking.startTime).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-700">
                        {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {driverState.students.find((s) => s.id === booking.studentId)?.fullName ?? 'Unknown Student'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${booking.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-700'
                      }`}>
                      {booking.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </li>
              ))}
              {driverState.pastBookings.length === 0 ? (
                <li className="text-xs text-slate-700 text-center py-4">No lesson history yet.</li>
              ) : null}
            </ul>
          </SummaryCard>
        </div>
      </AppShell>

      {/* Phase 4: Cancel Booking Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmCancel !== null}
        title="Cancel Booking"
        message={confirmCancel ? `Are you sure you want to cancel the booking with ${confirmCancel.studentName}? This action cannot be undone.` : ''}
        confirmLabel="Yes, Cancel Booking"
        cancelLabel="Keep Booking"
        variant="danger"
        loading={isCancelling}
        onConfirm={() => confirmCancel && cancelBooking(confirmCancel.bookingId)}
        onCancel={() => setConfirmCancel(null)}
      />
    </Protected>
  );
}
