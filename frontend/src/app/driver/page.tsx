'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Protected } from '../auth/Protected';
import { AppShell } from '../components/AppShell';
import { SummaryCard } from '../components/SummaryCard';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { MapViewer } from '../components/MapViewer';
import { MapPicker } from '../components/MapPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddToCalendarButton } from '../components/AddToCalendarButton';
import { createDriverLessonEvent } from '../utils/calendar';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../apiClient';

type DriverProfile = {
  id: number;
  fullName: string;
  active: boolean;
  serviceCenterLocation?: { latitude: number; longitude: number } | null;
  workDayStart?: string | null;
  workDayEnd?: string | null;
  serviceRadiusKm?: string | null;
  lessonDurationMinutes?: number | null;
  bufferMinutesBetweenLessons?: number | null;
};
type Availability = { id: number; date: string; startTime: string; endTime: string; type?: string };
type Booking = { id: number; driverId: number; studentId: number; startTime: string; status: string; pickupAddressId?: number | null; dropoffAddressId?: number | null };
type StudentProfile = {
  id: number;
  fullName: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  licenceNumber?: string | null;
  licenceStatus?: string;
  licenceExpiryDate?: string | null;
  licenceProvinceOrState?: string | null;
  isMinor?: boolean;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  active?: boolean;
};
type StudentAddress = {
  id: number;
  label?: string | null;
  line1: string;
  line2?: string | null;
  city?: string | null;
  provinceOrState?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefaultPickup?: boolean;
  isDefaultDropoff?: boolean;
};
type Address = { id: number; latitude: number | null; longitude: number | null; label: string; line1: string; city: string };

type AvailabilityForm = { dateStart: string; dateEnd: string; startTime: string; endTime: string };

type DriverState = {
  driver: DriverProfile | null;
  availability: Availability[];
  bookings: Booking[];
  pastBookings: Booking[];
  students: StudentProfile[];
};

// Wrapper component with Suspense for useSearchParams
export default function DriverPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <DriverPageContent />
    </Suspense>
  );
}

function DriverPageContent() {
  const { token, user } = useAuth();
  const schoolId = useMemo(() => user?.schoolId, [user?.schoolId]);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [driverState, setDriverState] = useState<DriverState>({
    driver: null,
    availability: [],
    bookings: [],
    pastBookings: [],
    students: [],
  });
  const [status, setStatus] = useState<string>('Loading driver data...');
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityForm>({ dateStart: '', dateEnd: '', startTime: '', endTime: '' });
  const [reschedule, setReschedule] = useState<Record<number, string>>({});
  const [cancelReason, setCancelReason] = useState<Record<number, string>>({});
  const [actionMessage, setActionMessage] = useState('');
  const [holidayRange, setHolidayRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Phase 3: Student history viewer
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentHistory, setStudentHistory] = useState<Booking[]>([]);
  const [studentUsage, setStudentUsage] = useState<{ usedHours: number; allowedHours: number | null } | null>(null);
  const [studentAddresses, setStudentAddresses] = useState<StudentAddress[]>([]);

  // All addresses lookup (for calendar events)
  const [allAddresses, setAllAddresses] = useState<Map<number, StudentAddress>>(new Map());

  // Phase 4: Confirmation dialog state
  const [confirmCancel, setConfirmCancel] = useState<{ bookingId: number; studentName: string } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Service Center and Working Hours state
  const [serviceCenterCoords, setServiceCenterCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(25); // Default 25km
  const [workingHours, setWorkingHours] = useState<{ start: string; end: string }>({ start: '09:00', end: '17:00' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Instructor Settings state (lesson duration, buffer, daily cap)
  const [instructorSettings, setInstructorSettings] = useState<{
    lessonDurationMinutes: string;
    bufferMinutesBetweenLessons: string;
    dailyBookingCap: string;
  }>({
    lessonDurationMinutes: '90',
    bufferMinutesBetweenLessons: '15',
    dailyBookingCap: '8',
  });

  // Tab navigation - read from URL query param
  const tabFromUrl = searchParams.get('tab') as 'overview' | 'schedule' | 'students' | null;
  const activeTab = tabFromUrl || 'overview';

  const availabilitySummary = driverState.availability.map((slot) => ({
    day: new Date(slot.date).toLocaleDateString(),
    window: `${slot.startTime}–${slot.endTime}`,
  }));

  const upcomingLessons = driverState.bookings.map((booking) => {
    const pickupAddr = booking.pickupAddressId ? allAddresses.get(booking.pickupAddressId) : null;
    const dropoffAddr = booking.dropoffAddressId ? allAddresses.get(booking.dropoffAddressId) : null;

    const formatAddress = (addr: StudentAddress | null | undefined): string | undefined => {
      if (!addr) return undefined;
      const parts = [addr.line1];
      if (addr.city) parts.push(addr.city);
      if (addr.provinceOrState) parts.push(addr.provinceOrState);
      return parts.join(', ');
    };

    return {
      time: new Date(booking.startTime).toLocaleString(),
      rawStartTime: booking.startTime,
      status: booking.status,
      id: booking.id,
      student: driverState.students.find((student) => student.id === booking.studentId)?.fullName ?? 'Student',
      pickupAddress: formatAddress(pickupAddr),
      dropoffAddress: formatAddress(dropoffAddr),
    };
  });

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

      // Populate service center and working hours from driver profile
      if (activeDriver.serviceCenterLocation) {
        setServiceCenterCoords(activeDriver.serviceCenterLocation);
      }
      if (activeDriver.serviceRadiusKm) {
        setServiceRadiusKm(Number(activeDriver.serviceRadiusKm));
      }
      if (activeDriver.workDayStart || activeDriver.workDayEnd) {
        setWorkingHours({
          start: activeDriver.workDayStart || '09:00',
          end: activeDriver.workDayEnd || '17:00',
        });
      }

      // Initialize instructor settings from driver profile
      setInstructorSettings({
        lessonDurationMinutes: activeDriver.lessonDurationMinutes?.toString() || '90',
        bufferMinutesBetweenLessons: activeDriver.bufferMinutesBetweenLessons?.toString() || '15',
        dailyBookingCap: '8', // Daily cap is managed per driver, default 8
      });

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

      // Fetch addresses for students who have bookings with this driver
      const driverBookings = upcomingResults.filter((booking) => booking.driverId === activeDriver.id);
      const studentIdsWithBookings = [...new Set(driverBookings.map(b => b.studentId))];
      const addressMap = new Map<number, StudentAddress>();

      // Fetch addresses for each student with a booking
      await Promise.all(
        studentIdsWithBookings.map(async (studentId) => {
          try {
            const addresses = await apiFetch<StudentAddress[]>(
              `/schools/${schoolId}/students/${studentId}/addresses`,
              token
            );
            addresses.forEach(addr => addressMap.set(addr.id, addr));
          } catch {
            // Ignore address fetch errors
          }
        })
      );

      setAllAddresses(addressMap);
      setStatus('');
    } catch (err) {
      setStatus('Unable to load driver profile. Check your token and backend availability.');
    }
  }

  async function saveServiceCenter() {
    if (!token || !schoolId || !driverState.driver || !serviceCenterCoords) return;
    setIsSavingProfile(true);
    setActionMessage('Saving service center location...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCenterLocation: serviceCenterCoords,
          serviceRadiusKm: serviceRadiusKm,
        }),
      });
      await loadDriverContext();
      setActionMessage('Service center location and radius saved!');
    } catch (err) {
      setActionMessage('Unable to save service center location.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function saveWorkingHours() {
    if (!token || !schoolId || !driverState.driver) return;
    setIsSavingProfile(true);
    setActionMessage('Saving default working hours...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workDayStart: workingHours.start, workDayEnd: workingHours.end }),
      });
      await loadDriverContext();
      setActionMessage('Default working hours saved!');
    } catch (err) {
      setActionMessage('Unable to save working hours.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function saveInstructorSettings() {
    if (!token || !schoolId || !driverState.driver) return;
    setIsSavingProfile(true);
    setActionMessage('Saving instructor settings...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonDurationMinutes: instructorSettings.lessonDurationMinutes
            ? Number(instructorSettings.lessonDurationMinutes)
            : null,
          bufferMinutesBetweenLessons: instructorSettings.bufferMinutesBetweenLessons
            ? Number(instructorSettings.bufferMinutesBetweenLessons)
            : null,
        }),
      });
      await loadDriverContext();
      setActionMessage('Instructor settings saved!');
    } catch (err) {
      setActionMessage('Unable to save instructor settings.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  useEffect(() => {
    loadDriverContext();
  }, [schoolId, token]);

  // Phase 3: Load selected student's history and profile details
  async function loadStudentHistory(studentId: number) {
    if (!token || !schoolId) return;
    setSelectedStudentId(studentId);
    setStudentAddresses([]);
    try {
      const [bookingsResult, usageResult, addressesResult] = await Promise.all([
        apiFetch<Booking[]>(`/schools/${schoolId}/bookings?studentId=${studentId}`, token).catch(() => []),
        apiFetch<{ usedHours: number; allowedHours: number | null }>(
          `/schools/${schoolId}/students/${studentId}/usage`,
          token
        ).catch(() => null),
        apiFetch<StudentAddress[]>(`/schools/${schoolId}/students/${studentId}/addresses`, token).catch(() => []),
      ]);
      setStudentHistory(bookingsResult);
      setStudentUsage(usageResult);
      setStudentAddresses(addressesResult);
    } catch (err) {
      console.error('Unable to load student history');
    }
  }

  async function publishAvailability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId || !driverState.driver) return;

    const startDate = new Date(availabilityForm.dateStart);
    const endDate = new Date(availabilityForm.dateEnd || availabilityForm.dateStart);

    if (endDate < startDate) {
      setActionMessage('End date must be after start date.');
      return;
    }

    const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    setActionMessage(`Publishing availability for ${dayCount} day(s)...`);

    try {
      // Create entries for each day in the range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().slice(0, 10);
        await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}/availability`, token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: dateStr,
            startTime: availabilityForm.startTime,
            endTime: availabilityForm.endTime,
            type: 'working_hours',
          }),
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      setAvailabilityForm({ dateStart: '', dateEnd: '', startTime: '', endTime: '' });
      await loadDriverContext();
      setActionMessage(`Availability published for ${dayCount} day(s)!`);
    } catch (err) {
      setActionMessage('Unable to publish availability.');
    }
  }

  async function addHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId || !driverState.driver || !holidayRange.start) return;

    const startDate = new Date(holidayRange.start);
    const endDate = new Date(holidayRange.end || holidayRange.start);

    if (endDate < startDate) {
      setActionMessage('End date must be after start date.');
      return;
    }

    // Check for conflicts
    const conflictDates: string[] = [];
    const alreadyBlockedDates: string[] = [];
    const checkDate = new Date(startDate);
    while (checkDate <= endDate) {
      const dateStr = checkDate.toISOString().slice(0, 10);

      // Check if already blocked
      if (driverState.availability.some(a => a.date === dateStr && a.type === 'override_closed')) {
        alreadyBlockedDates.push(new Date(dateStr).toLocaleDateString());
      }

      // Check if has open slots
      if (driverState.availability.some(a => a.date === dateStr && a.type === 'working_hours')) {
        conflictDates.push(new Date(dateStr).toLocaleDateString());
      }

      checkDate.setDate(checkDate.getDate() + 1);
    }

    // Error if all dates are already blocked
    if (alreadyBlockedDates.length === Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1) {
      setActionMessage(`⚠️ All selected dates are already blocked: ${alreadyBlockedDates.join(', ')}`);
      return;
    }

    const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Show warning but proceed if there are open slots that will be overridden
    let warningMsg = '';
    if (conflictDates.length > 0) {
      warningMsg = ` (Note: This will block ${conflictDates.length} day(s) that had open availability)`;
    }

    setActionMessage(`Adding time off for ${dayCount} day(s)...${warningMsg}`);

    try {
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().slice(0, 10);

        // Skip if already blocked
        if (!driverState.availability.some(a => a.date === dateStr && a.type === 'override_closed')) {
          await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}/availability`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: dateStr,
              startTime: '00:00',
              endTime: '23:59',
              type: 'override_closed',
            }),
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      setHolidayRange({ start: '', end: '' });
      await loadDriverContext();
      setActionMessage(`Time off added for ${dayCount} day(s)!${warningMsg}`);
    } catch (err) {
      setActionMessage('Unable to add time off.');
    }
  }

  // Check if a date has existing working_hours availability
  function hasOpenSlotOnDate(dateStr: string): boolean {
    return driverState.availability.some(
      a => a.date === dateStr && a.type === 'working_hours'
    );
  }

  // Check if a date is already blocked
  function hasBlockedSlotOnDate(dateStr: string): boolean {
    return driverState.availability.some(
      a => a.date === dateStr && a.type === 'override_closed'
    );
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

  async function removeAvailabilitySlot(availabilityId: number) {
    if (!token || !schoolId || !driverState.driver) return;
    setActionMessage('Removing availability slot...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}/availability/${availabilityId}`, token, {
        method: 'DELETE',
      });
      await loadDriverContext();
      setActionMessage('Availability slot removed.');
    } catch (err) {
      setActionMessage('Unable to remove availability slot.');
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
            <h1 className="text-2xl font-semibold text-slate-900">Instructor Dashboard</h1>
            <p className="text-sm text-slate-700">
              Manage your schedule, view student profiles, and track your lessons.
            </p>
            <p className="text-xs text-slate-700">
              {driverState.driver ? `Active profile: ${driverState.driver.fullName}` : 'No driver profile loaded yet.'}
            </p>
            {actionMessage ? <p className="text-[11px] text-emerald-600 font-medium">{actionMessage}</p> : null}
          </div>

          {/* Today's Schedule - Prominent at the top */}
          {upcomingLessons.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                🚗 Today's Schedule
                <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {upcomingLessons.filter(l => {
                    const lessonDate = new Date(l.rawStartTime).toDateString();
                    const today = new Date().toDateString();
                    return lessonDate === today;
                  }).length} lesson(s) today
                </span>
              </h2>
              <div className="space-y-3">
                {upcomingLessons
                  .filter(l => {
                    const lessonDate = new Date(l.rawStartTime).toDateString();
                    const today = new Date().toDateString();
                    return lessonDate === today;
                  })
                  .sort((a, b) => new Date(a.rawStartTime).getTime() - new Date(b.rawStartTime).getTime())
                  .map((lesson) => (
                    <div key={`today-${lesson.id}`} className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-semibold text-slate-900">
                              {new Date(lesson.rawStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${lesson.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                              {lesson.status}
                            </span>
                          </div>
                          <p className="font-medium text-slate-800">{lesson.student}</p>
                          {lesson.pickupAddress && (
                            <p className="text-xs text-slate-600 mt-1">
                              📍 Pickup: {lesson.pickupAddress}
                            </p>
                          )}
                          {lesson.dropoffAddress && lesson.dropoffAddress !== lesson.pickupAddress && (
                            <p className="text-xs text-slate-600">
                              🏁 Dropoff: {lesson.dropoffAddress}
                            </p>
                          )}
                        </div>
                        <AddToCalendarButton
                          event={createDriverLessonEvent(
                            lesson.student,
                            new Date(lesson.rawStartTime),
                            new Date(new Date(lesson.rawStartTime).getTime() + 90 * 60 * 1000),
                            lesson.pickupAddress,
                            lesson.dropoffAddress,
                          )}
                        />
                      </div>
                    </div>
                  ))}
                {upcomingLessons.filter(l => {
                  const lessonDate = new Date(l.rawStartTime).toDateString();
                  const today = new Date().toDateString();
                  return lessonDate === today;
                }).length === 0 && (
                    <p className="text-sm text-slate-600 text-center py-2">No lessons scheduled for today.</p>
                  )}
              </div>
            </div>
          )}

          {/* Overview Tab Content */}
          {activeTab === 'overview' && (
            <>
              {/* Service Center Location & Default Working Hours */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SummaryCard
                  title="📍 Service Center Location"
                  description="Set your base location and service radius. Students can only book if pickup/dropoff is within your radius."
                  footer={serviceCenterCoords
                    ? `Lat: ${serviceCenterCoords.latitude.toFixed(4)}, Lng: ${serviceCenterCoords.longitude.toFixed(4)} | Radius: ${serviceRadiusKm}km`
                    : 'Not set - required for bookings!'}
                >
                  <div className="space-y-3">
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      ⚠️ Click on the map to set your location, adjust the radius, then click "Save Service Center" below.
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Service Radius: <span className="font-bold text-blue-600">{serviceRadiusKm} km</span>
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="5"
                        value={serviceRadiusKm}
                        onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>5km</span>
                        <span>50km</span>
                        <span>100km</span>
                      </div>
                    </div>
                    <MapPicker
                      latitude={serviceCenterCoords?.latitude}
                      longitude={serviceCenterCoords?.longitude}
                      radiusKm={serviceRadiusKm}
                      onLocationSelect={(lat, lng) => setServiceCenterCoords({ latitude: lat, longitude: lng })}
                    />
                    <button
                      className="w-full bg-blue-600 text-white rounded px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
                      onClick={saveServiceCenter}
                      disabled={!serviceCenterCoords || isSavingProfile}
                    >
                      {isSavingProfile ? 'Saving...' : '💾 Save Service Center & Radius'}
                    </button>
                  </div>
                </SummaryCard>

                <SummaryCard
                  title="⏰ Default Working Hours"
                  description="Set your typical daily hours. Used when no specific availability is published for a date."
                  footer={driverState.driver?.workDayStart && driverState.driver?.workDayEnd
                    ? `Current: ${driverState.driver.workDayStart} - ${driverState.driver.workDayEnd}`
                    : 'Not set - will default to 09:00-17:00'}
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Start Time</label>
                        <input
                          type="time"
                          className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                          value={workingHours.start}
                          onChange={(e) => setWorkingHours({ ...workingHours, start: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">End Time</label>
                        <input
                          type="time"
                          className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                          value={workingHours.end}
                          onChange={(e) => setWorkingHours({ ...workingHours, end: e.target.value })}
                        />
                      </div>
                    </div>
                    <button
                      className="w-full bg-green-600 text-white rounded px-3 py-2 text-sm hover:bg-green-700 disabled:opacity-50"
                      onClick={saveWorkingHours}
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? 'Saving...' : '💾 Save Working Hours'}
                    </button>
                    <p className="text-xs text-slate-600">
                      💡 Tip: You can also set specific availability for individual dates using the form below.
                    </p>
                  </div>
                </SummaryCard>
              </div>

              {/* Instructor Settings Card */}
              <SummaryCard
                title="⚙️ Instructor Settings"
                description="Configure lesson parameters. These settings control how your bookings work."
                footer={`Lesson: ${instructorSettings.lessonDurationMinutes || 90}min | Buffer: ${instructorSettings.bufferMinutesBetweenLessons || 15}min | Daily cap: ${instructorSettings.dailyBookingCap || 8} lessons`}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Lesson Duration (min)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="180"
                        className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                        value={instructorSettings.lessonDurationMinutes}
                        onChange={(e) =>
                          setInstructorSettings({ ...instructorSettings, lessonDurationMinutes: e.target.value })
                        }
                        placeholder="90"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Buffer Between Lessons (min)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                        value={instructorSettings.bufferMinutesBetweenLessons}
                        onChange={(e) =>
                          setInstructorSettings({ ...instructorSettings, bufferMinutesBetweenLessons: e.target.value })
                        }
                        placeholder="15"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Daily Booking Cap
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                        value={instructorSettings.dailyBookingCap}
                        onChange={(e) =>
                          setInstructorSettings({ ...instructorSettings, dailyBookingCap: e.target.value })
                        }
                        placeholder="8"
                      />
                    </div>
                  </div>
                  <button
                    className="w-full bg-purple-600 text-white rounded px-3 py-2 text-sm hover:bg-purple-700 disabled:opacity-50"
                    onClick={saveInstructorSettings}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? 'Saving...' : '💾 Save Instructor Settings'}
                  </button>
                  <p className="text-xs text-slate-600">
                    💡 Defaults: 90 min lessons, 15 min buffer, 8 lessons/day max.
                  </p>
                </div>
              </SummaryCard>

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
                            {lesson.pickupAddress && (
                              <p className="text-[11px] text-blue-600">📍 Pickup: {lesson.pickupAddress}</p>
                            )}
                            {lesson.dropoffAddress && lesson.dropoffAddress !== lesson.pickupAddress && (
                              <p className="text-[11px] text-green-600">🏁 Dropoff: {lesson.dropoffAddress}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs items-center">
                          <AddToCalendarButton
                            event={createDriverLessonEvent(
                              lesson.student,
                              new Date(lesson.rawStartTime),
                              new Date(new Date(lesson.rawStartTime).getTime() + 90 * 60 * 1000), // 90 min lesson
                              lesson.pickupAddress,
                              lesson.dropoffAddress,
                            )}
                          />
                          <input
                            className="border rounded px-2 py-1"
                            type="datetime-local"
                            value={reschedule[lesson.id] ?? ''}
                            onChange={(e) => setReschedule((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                            placeholder="New start time"
                          />
                          <button
                            className="px-3 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 min-h-[32px]"
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
                            className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-500 min-h-[32px]"
                            type="button"
                            onClick={() => setConfirmCancel({ bookingId: lesson.id, studentName: lesson.student })}
                          >
                            Cancel
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-500 min-h-[32px]"
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
            </>
          )}

          {/* My Schedule Tab Content */}
          {activeTab === 'schedule' && (
            <>
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
            </>
          )}

          {/* Students Tab Content */}
          {activeTab === 'students' && (
            <>
              {/* Student Profiles Section - Comprehensive Student Information */}
              <SummaryCard
                title="👤 Student Profiles"
                description="View complete student information including contact details, licence info, addresses, and lesson history."
                footer={selectedStudentId ? `Viewing student ID ${selectedStudentId}` : 'Select a student to view their profile'}
              >
                <div className="space-y-4">
                  <select
                    className="w-full border rounded px-3 py-2 text-sm text-slate-900 bg-white"
                    value={selectedStudentId ?? ''}
                    onChange={(e) => e.target.value && loadStudentHistory(Number(e.target.value))}
                  >
                    <option value="">-- Select a student --</option>
                    {driverState.students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName} {student.isMinor ? '(Minor)' : ''} {student.licenceStatus === 'approved' ? '✓' : ''}
                      </option>
                    ))}
                  </select>

                  {selectedStudentId && (() => {
                    const selectedStudent = driverState.students.find(s => s.id === selectedStudentId);
                    if (!selectedStudent) return null;

                    // Calculate age from date of birth
                    const calculateAge = (dob: string | null | undefined): number | null => {
                      if (!dob) return null;
                      const birthDate = new Date(dob);
                      const today = new Date();
                      let age = today.getFullYear() - birthDate.getFullYear();
                      const monthDiff = today.getMonth() - birthDate.getMonth();
                      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                      }
                      return age;
                    };
                    const studentAge = calculateAge(selectedStudent.dateOfBirth);

                    return (
                      <div className="space-y-4">
                        {/* Personal Information Card */}
                        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            📋 Personal Information
                            {selectedStudent.active === false && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">Inactive</span>
                            )}
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="text-slate-500 block">Full Name</span>
                              <p className="font-semibold text-slate-900">{selectedStudent.fullName}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Age</span>
                              <p className="font-semibold text-slate-900">
                                {studentAge !== null ? `${studentAge} years old` : 'Not provided'}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Date of Birth</span>
                              <p className="font-semibold text-slate-900">
                                {selectedStudent.dateOfBirth
                                  ? new Date(selectedStudent.dateOfBirth).toLocaleDateString()
                                  : 'Not provided'}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Phone</span>
                              <p className="font-semibold text-slate-900">
                                {selectedStudent.phone ? (
                                  <a href={`tel:${selectedStudent.phone}`} className="text-blue-600 hover:underline">
                                    {selectedStudent.phone}
                                  </a>
                                ) : 'Not provided'}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Email</span>
                              <p className="font-semibold text-slate-900">
                                {selectedStudent.email ? (
                                  <a href={`mailto:${selectedStudent.email}`} className="text-blue-600 hover:underline">
                                    {selectedStudent.email}
                                  </a>
                                ) : 'Not provided'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Minor/Guardian Information */}
                        {selectedStudent.isMinor && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                              👶 Minor Student - Guardian Information
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-amber-700 block">Guardian Phone</span>
                                <p className="font-semibold text-slate-900">
                                  {selectedStudent.guardianPhone ? (
                                    <a href={`tel:${selectedStudent.guardianPhone}`} className="text-blue-600 hover:underline">
                                      {selectedStudent.guardianPhone}
                                    </a>
                                  ) : 'Not provided'}
                                </p>
                              </div>
                              <div>
                                <span className="text-amber-700 block">Guardian Email</span>
                                <p className="font-semibold text-slate-900">
                                  {selectedStudent.guardianEmail ? (
                                    <a href={`mailto:${selectedStudent.guardianEmail}`} className="text-blue-600 hover:underline">
                                      {selectedStudent.guardianEmail}
                                    </a>
                                  ) : 'Not provided'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Licence Information Card */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                            🪪 Licence Information
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedStudent.licenceStatus === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : selectedStudent.licenceStatus === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                              }`}>
                              {selectedStudent.licenceStatus?.replace(/_/g, ' ') || 'Pending Review'}
                            </span>
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="text-blue-600 block">Licence Number</span>
                              <p className="font-semibold text-slate-900 font-mono">
                                {selectedStudent.licenceNumber || 'Not provided'}
                              </p>
                            </div>
                            <div>
                              <span className="text-blue-600 block">Expiry Date</span>
                              <p className={`font-semibold ${selectedStudent.licenceExpiryDate && new Date(selectedStudent.licenceExpiryDate) < new Date()
                                ? 'text-red-600'
                                : 'text-slate-900'
                                }`}>
                                {selectedStudent.licenceExpiryDate
                                  ? new Date(selectedStudent.licenceExpiryDate).toLocaleDateString()
                                  : 'Not provided'}
                                {selectedStudent.licenceExpiryDate && new Date(selectedStudent.licenceExpiryDate) < new Date() && (
                                  <span className="ml-1 text-red-600">(Expired!)</span>
                                )}
                              </p>
                            </div>
                            <div>
                              <span className="text-blue-600 block">Province/State</span>
                              <p className="font-semibold text-slate-900">
                                {selectedStudent.licenceProvinceOrState || 'Not provided'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Addresses Card */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                            📍 Saved Addresses
                            <span className="text-xs font-normal text-green-600">({studentAddresses.length} addresses)</span>
                          </h3>
                          {studentAddresses.length > 0 ? (
                            <ul className="space-y-2">
                              {studentAddresses.map((addr) => (
                                <li key={addr.id} className="bg-white border border-green-100 rounded p-3 text-xs">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      {addr.label && (
                                        <p className="font-semibold text-slate-800 mb-1">{addr.label}</p>
                                      )}
                                      <p className="text-slate-700">{addr.line1}</p>
                                      {addr.line2 && <p className="text-slate-600">{addr.line2}</p>}
                                      <p className="text-slate-600">
                                        {[addr.city, addr.provinceOrState, addr.postalCode].filter(Boolean).join(', ')}
                                      </p>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      {addr.isDefaultPickup && (
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                                          🚗 Pickup
                                        </span>
                                      )}
                                      {addr.isDefaultDropoff && (
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                                          🏁 Dropoff
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-green-700 text-center py-2">No addresses saved yet.</p>
                          )}
                        </div>

                        {/* Usage Statistics Card */}
                        {studentUsage && (
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-purple-800 mb-3">📊 Usage Statistics</h3>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-purple-600 block">Hours Used</span>
                                <p className="font-semibold text-slate-900 text-lg">{studentUsage.usedHours.toFixed(1)} hrs</p>
                              </div>
                              <div>
                                <span className="text-purple-600 block">Allowed Hours</span>
                                <p className="font-semibold text-slate-900 text-lg">
                                  {studentUsage.allowedHours !== null ? `${studentUsage.allowedHours} hrs` : 'Unlimited'}
                                </p>
                              </div>
                            </div>
                            {studentUsage.allowedHours !== null && (
                              <div className="mt-3">
                                <div className="w-full bg-purple-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${studentUsage.usedHours >= studentUsage.allowedHours
                                      ? 'bg-red-500'
                                      : studentUsage.usedHours >= studentUsage.allowedHours * 0.8
                                        ? 'bg-amber-500'
                                        : 'bg-purple-600'
                                      }`}
                                    style={{ width: `${Math.min((studentUsage.usedHours / studentUsage.allowedHours) * 100, 100)}%` }}
                                  />
                                </div>
                                <p className="text-xs text-purple-600 mt-1 text-center">
                                  {((studentUsage.usedHours / studentUsage.allowedHours) * 100).toFixed(0)}% of allowed hours used
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Lesson History Card */}
                        <div className="bg-white border rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-slate-800 mb-3">📚 Lesson History</h3>
                          {studentHistory.length > 0 ? (
                            <ul className="space-y-2 max-h-48 overflow-y-auto">
                              {studentHistory.map((booking) => (
                                <li key={booking.id} className="border rounded p-2 bg-slate-50 text-xs">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="font-medium text-slate-900">{new Date(booking.startTime).toLocaleDateString()}</p>
                                      <p className="text-slate-600">
                                        {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${booking.status === 'completed' ? 'bg-green-100 text-green-800'
                                      : booking.status === 'scheduled' ? 'bg-blue-100 text-blue-800'
                                        : booking.status.includes('cancelled') ? 'bg-red-100 text-red-800'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}>
                                      {booking.status.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-500 text-center py-4">No lesson history for this student.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {!selectedStudentId && (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">👥</p>
                      <p className="text-sm text-slate-600">
                        Select a student from the dropdown above to view their complete profile.
                      </p>
                    </div>
                  )}
                </div>
              </SummaryCard>
            </>
          )}

          {/* My Schedule Tab - Additional Sections */}
          {activeTab === 'schedule' && (
            <>
              {/* Publish Availability */}
              <SummaryCard
                title="📅 Publish Availability"
                description="Set your working hours for a date range. Students can book within these windows."
              >
                <form className="space-y-3 text-sm" onSubmit={publishAvailability}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                      <input
                        className="w-full border rounded px-2 py-2 text-slate-900"
                        type="date"
                        value={availabilityForm.dateStart}
                        onChange={(e) => setAvailabilityForm({ ...availabilityForm, dateStart: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">End Date (optional)</label>
                      <input
                        className="w-full border rounded px-2 py-2 text-slate-900"
                        type="date"
                        value={availabilityForm.dateEnd}
                        onChange={(e) => setAvailabilityForm({ ...availabilityForm, dateEnd: e.target.value })}
                        min={availabilityForm.dateStart}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Start Time</label>
                      <input
                        className="w-full border rounded px-2 py-2 text-slate-900"
                        type="time"
                        value={availabilityForm.startTime}
                        onChange={(e) => setAvailabilityForm({ ...availabilityForm, startTime: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">End Time</label>
                      <input
                        className="w-full border rounded px-2 py-2 text-slate-900"
                        type="time"
                        value={availabilityForm.endTime}
                        onChange={(e) => setAvailabilityForm({ ...availabilityForm, endTime: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <button className="w-full px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800" type="submit">
                    📆 Publish Availability
                  </button>
                </form>

                {/* List of published availability slots */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">
                    📋 Published Availability ({driverState.availability.filter(a => a.type === 'working_hours').length} slot(s))
                  </h4>
                  <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                    {driverState.availability
                      .filter(a => a.type === 'working_hours')
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((slot) => (
                        <li key={slot.id} className="flex justify-between items-center border rounded p-2 bg-green-50">
                          <div>
                            <span className="font-medium">{new Date(slot.date).toLocaleDateString()}</span>
                            <span className="text-xs text-slate-600 ml-2">
                              {slot.startTime} - {slot.endTime}
                            </span>
                            <span className="text-xs text-green-600 ml-2">✓ Available</span>
                          </div>
                          <button
                            className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                            onClick={() => removeAvailabilitySlot(slot.id)}
                          >
                            🗑️ Remove
                          </button>
                        </li>
                      ))}
                    {driverState.availability.filter(a => a.type === 'working_hours').length === 0 ? (
                      <li className="text-xs text-slate-500 text-center py-2">
                        No availability published yet. Use the form above to add availability.
                      </li>
                    ) : null}
                  </ul>
                </div>
              </SummaryCard>
              <SummaryCard
                title="🏖️ Time Off / Holidays"
                description="Mark days you're unavailable. Students won't be able to book on these dates."
                footer={`${driverState.availability.filter(a => a.type === 'override_closed').length} day(s) blocked`}
              >
                <form className="space-y-3 mb-3" onSubmit={addHoliday}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                      <input
                        className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                        type="date"
                        value={holidayRange.start}
                        onChange={(e) => setHolidayRange({ ...holidayRange, start: e.target.value })}
                        required
                        min={new Date().toISOString().slice(0, 10)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">End Date (optional)</label>
                      <input
                        className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                        type="date"
                        value={holidayRange.end}
                        onChange={(e) => setHolidayRange({ ...holidayRange, end: e.target.value })}
                        min={holidayRange.start || new Date().toISOString().slice(0, 10)}
                      />
                    </div>
                  </div>
                  <button
                    className="w-full px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
                    type="submit"
                  >
                    ⛔ Block Date Range
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
            </>
          )}
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
