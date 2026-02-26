'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import toast from 'react-hot-toast';

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
import { EarningsCard } from '../components/EarningsCard';
import { createDriverLessonEvent } from '../utils/calendar';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch, ApiError, getErrorMessage } from '../apiClient';
import { PageLoading } from '../components/LoadingSpinner';
import { formatDateTime, formatDate, formatTime, todayDateString, toDateStringHalifax } from '../utils/timezone';
import { SchoolSelectorBanner } from '../components/SchoolSelectorBanner';

type DriverProfile = {
  id: number;
  fullName: string;
  phone?: string | null;
  email?: string | null;
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

type SchoolSettings = {
  id: number;
  minBookingLeadTimeHours: number | null;
  cancellationCutoffHours: number | null;
  defaultLessonDurationMinutes: number | null;
  defaultBufferMinutesBetweenLessons: number | null;
  defaultServiceRadiusKm: string | null;
  dailyBookingCapPerDriver: number | null;
  allowStudentToPickDriver: boolean;
  allowDriverSelfAvailabilityEdit: boolean;
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
  const isSuperadmin = user?.role === 'superadmin';
  const [overrideSchoolId, setOverrideSchoolId] = useState<number | null>(null);
  const schoolId = useMemo(() => overrideSchoolId ?? user?.schoolId, [overrideSchoolId, user?.schoolId]);
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
  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [isUpdatingBooking, setIsUpdatingBooking] = useState(false);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<{ id: number; date: string } | null>(null);
  const [confirmDeleteBlock, setConfirmDeleteBlock] = useState<{ id: number; date: string } | null>(null);

  // Contact Info state
  const [contactForm, setContactForm] = useState({ phone: '', email: '' });
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Student profile modal
  const [viewingStudent, setViewingStudent] = useState<StudentProfile | null>(null);

  // Service Center and Working Hours state
  const [serviceCenterCoords, setServiceCenterCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(25); // Default 25km
  const [workingHours, setWorkingHours] = useState<{ start: string; end: string }>({ start: '09:00', end: '17:00' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);


  // School Settings state
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [schoolSettingsForm, setSchoolSettingsForm] = useState({
    minBookingLeadTimeHours: '',
    cancellationCutoffHours: '',
    defaultLessonDurationMinutes: '',
    defaultBufferMinutesBetweenLessons: '',
    defaultServiceRadiusKm: '',
    dailyBookingCapPerDriver: '',
    allowStudentToPickDriver: true,
    allowDriverSelfAvailabilityEdit: true,
  });
  const [isSavingSchoolSettings, setIsSavingSchoolSettings] = useState(false);

  // Tab navigation - read from URL query param
  const tabFromUrl = searchParams.get('tab') as 'overview' | 'schedule' | 'students' | null;
  const activeTab = tabFromUrl || 'overview';

  const availabilitySummary = driverState.availability.map((slot) => ({
    day: formatDate(slot.date),
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
      time: formatDateTime(booking.startTime),
      rawStartTime: booking.startTime,
      status: booking.status,
      id: booking.id,
      studentId: booking.studentId,
      student: driverState.students.find((student) => student.id === booking.studentId)?.fullName ?? 'Student',
      pickupAddress: formatAddress(pickupAddr),
      dropoffAddress: formatAddress(dropoffAddr),
    };
  });

  async function loadDriverContext() {
    if (!token || !schoolId) { setStatus('No school context available.'); return; }
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
      setContactForm({
        phone: activeDriver.phone || '',
        email: activeDriver.email || '',
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
      // Fetch all addresses in one batch request instead of N+1
      const addressMap = new Map<number, StudentAddress>();
      if (studentIdsWithBookings.length > 0) {
        try {
          const batchAddresses = await apiFetch<StudentAddress[]>(
            `/schools/${schoolId}/addresses/batch?studentIds=${studentIdsWithBookings.join(',')}`,
            token
          );
          batchAddresses.forEach(addr => addressMap.set(addr.id, addr));
        } catch {
          // Ignore address fetch errors
        }
      }

      setAllAddresses(addressMap);
      setStatus('');
    } catch (err) {
      setStatus('Unable to load driver profile. Check your token and backend availability.');
    }
  }

  async function saveServiceCenter() {
    if (!token || !schoolId || !driverState.driver || !serviceCenterCoords) return;
    setIsSavingProfile(true);
    const toastId = toast.loading('Saving service center...');
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
      toast.success('Service center saved!', { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function saveWorkingHours() {
    if (!token || !schoolId || !driverState.driver) return;
    setIsSavingProfile(true);
    const toastId = toast.loading('Saving working hours...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workDayStart: workingHours.start, workDayEnd: workingHours.end }),
      });
      await loadDriverContext();
      toast.success('Working hours saved!', { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function saveContactInfo() {
    if (!token || !schoolId || !driverState.driver) return;
    setIsSavingContact(true);
    const toastId = toast.loading('Saving contact info...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: contactForm.phone || null, email: contactForm.email || null }),
      });
      await loadDriverContext();
      toast.success('Contact info saved!', { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      setIsSavingContact(false);
    }
  }

  async function loadSchoolSettings() {
    if (!token || !schoolId) return;
    try {
      const settings = await apiFetch<SchoolSettings>(`/schools/${schoolId}/settings`, token);
      setSchoolSettings(settings);
      setSchoolSettingsForm({
        minBookingLeadTimeHours: settings.minBookingLeadTimeHours?.toString() ?? '',
        cancellationCutoffHours: settings.cancellationCutoffHours?.toString() ?? '',
        defaultLessonDurationMinutes: settings.defaultLessonDurationMinutes?.toString() ?? '',
        defaultBufferMinutesBetweenLessons: settings.defaultBufferMinutesBetweenLessons?.toString() ?? '',
        defaultServiceRadiusKm: settings.defaultServiceRadiusKm ?? '',
        dailyBookingCapPerDriver: settings.dailyBookingCapPerDriver?.toString() ?? '',
        allowStudentToPickDriver: settings.allowStudentToPickDriver ?? true,
        allowDriverSelfAvailabilityEdit: settings.allowDriverSelfAvailabilityEdit ?? true,
      });
    } catch {
      // Ignore - settings may not be accessible to drivers
    }
  }

  async function saveSchoolSettings() {
    if (!token || !schoolId) return;
    setIsSavingSchoolSettings(true);
    const toastId = toast.loading('Saving settings...');
    try {
      await apiFetch(`/schools/${schoolId}/settings`, token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minBookingLeadTimeHours: schoolSettingsForm.minBookingLeadTimeHours
            ? Number(schoolSettingsForm.minBookingLeadTimeHours)
            : null,
          cancellationCutoffHours: schoolSettingsForm.cancellationCutoffHours
            ? Number(schoolSettingsForm.cancellationCutoffHours)
            : null,
          defaultLessonDurationMinutes: schoolSettingsForm.defaultLessonDurationMinutes
            ? Number(schoolSettingsForm.defaultLessonDurationMinutes)
            : null,
          defaultBufferMinutesBetweenLessons: schoolSettingsForm.defaultBufferMinutesBetweenLessons
            ? Number(schoolSettingsForm.defaultBufferMinutesBetweenLessons)
            : null,
          dailyBookingCapPerDriver: schoolSettingsForm.dailyBookingCapPerDriver
            ? Number(schoolSettingsForm.dailyBookingCapPerDriver)
            : null,
        }),
      });
      await loadSchoolSettings();
      toast.success('Settings saved!', { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      setIsSavingSchoolSettings(false);
    }
  }

  useEffect(() => {
    loadDriverContext();
    loadSchoolSettings();
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

    const startDateStr = availabilityForm.dateStart;
    const endDateStr = availabilityForm.dateEnd || availabilityForm.dateStart;

    if (endDateStr < startDateStr) {
      toast.error('End date must be after start date.');
      return;
    }

    // Build list of date strings directly to avoid timezone shifts
    const dates: string[] = [];
    const cur = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }

    const toastId = toast.loading(`Publishing availability for ${dates.length} day(s)...`);

    try {
      for (const dateStr of dates) {
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
      }
      setAvailabilityForm({ dateStart: '', dateEnd: '', startTime: '', endTime: '' });
      await loadDriverContext();
      toast.success(`Availability published for ${dates.length} day(s)!`, { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    }
  }

  async function addHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId || !driverState.driver || !holidayRange.start) return;

    const startDateStr = holidayRange.start;
    const endDateStr = holidayRange.end || holidayRange.start;

    if (endDateStr < startDateStr) {
      toast.error('End date must be after start date.');
      return;
    }

    // Build date strings without timezone shifts
    const holidayDates: string[] = [];
    const hCur = new Date(startDateStr + 'T00:00:00');
    const hEnd = new Date(endDateStr + 'T00:00:00');
    while (hCur <= hEnd) {
      const y = hCur.getFullYear();
      const m = String(hCur.getMonth() + 1).padStart(2, '0');
      const d = String(hCur.getDate()).padStart(2, '0');
      holidayDates.push(`${y}-${m}-${d}`);
      hCur.setDate(hCur.getDate() + 1);
    }

    // Check for conflicts
    const conflictDates: string[] = [];
    const alreadyBlockedDates: string[] = [];
    for (const dateStr of holidayDates) {
      if (driverState.availability.some(a => a.date === dateStr && a.type === 'override_closed')) {
        alreadyBlockedDates.push(formatDate(dateStr + 'T00:00:00'));
      }
      if (driverState.availability.some(a => a.date === dateStr && a.type === 'working_hours')) {
        conflictDates.push(formatDate(dateStr + 'T00:00:00'));
      }
    }

    // Error if all dates are already blocked
    if (alreadyBlockedDates.length === holidayDates.length) {
      toast.error(`All selected dates are already blocked: ${alreadyBlockedDates.join(', ')}`);
      return;
    }

    // ERROR if any dates have published availability - user must delete availability first
    if (conflictDates.length > 0) {
      toast.error(`Cannot block ${conflictDates.join(', ')} - delete availability first.`);
      return;
    }

    const toastId = toast.loading(`Adding time off for ${holidayDates.length} day(s)...`);

    try {
      for (const dateStr of holidayDates) {
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
      }
      setHolidayRange({ start: '', end: '' });
      await loadDriverContext();
      toast.success(`Time off added for ${holidayDates.length} day(s)!`, { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
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
    const toastId = toast.loading('Removing time off...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}/availability/${availabilityId}`, token, {
        method: 'DELETE',
      });
      await loadDriverContext();
      toast.success('Time off removed.', { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    }
  }

  async function removeAvailabilitySlot(availabilityId: number) {
    if (!token || !schoolId || !driverState.driver) return;
    const toastId = toast.loading('Removing availability...');
    try {
      await apiFetch(`/schools/${schoolId}/drivers/${driverState.driver.id}/availability/${availabilityId}`, token, {
        method: 'DELETE',
      });
      await loadDriverContext();
      toast.success('Availability removed.', { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    }
  }

  async function updateBooking(bookingId: number, newStart: string, force = false) {
    if (!token || !schoolId || !newStart || isUpdatingBooking) return;
    setIsUpdatingBooking(true);
    const toastId = toast.loading('Rescheduling...');
    try {
      const body: Record<string, string | boolean> = { startTime: new Date(newStart).toISOString() };
      if (force) body.force = true;
      await apiFetch(`/schools/${schoolId}/bookings/${bookingId}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setReschedule((prev) => ({ ...prev, [bookingId]: '' }));
      await loadDriverContext();
      toast.success('Booking rescheduled!', { id: toastId });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'REQUIRES_FORCE') {
        toast.dismiss(toastId);
        const confirmed = window.confirm(
          `${err.message}\n\nDo you want to proceed anyway?`
        );
        if (confirmed) {
          await updateBooking(bookingId, newStart, true);
        }
        return;
      }
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      setIsUpdatingBooking(false);
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
      toast.success('Booking cancelled.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsCancelling(false);
      setConfirmCancel(null);
    }
  }

  async function markCompleted(bookingId: number) {
    if (!token || !schoolId || markingCompleted) return;
    setMarkingCompleted(true);
    const toastId = toast.loading('Marking lesson as completed...');
    try {
      await apiFetch(`/schools/${schoolId}/bookings/${bookingId}/complete`, token, {
        method: 'POST',
      });
      await loadDriverContext();
      toast.success('Lesson marked as completed!', { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      setMarkingCompleted(false);
    }
  }

  // Superadmin without a school selected — show selector only
  if (isSuperadmin && !schoolId) {
    return (
      <Protected allowedRoles={['driver', 'school_admin', 'superadmin']}>
        <AppShell>
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-slate-900">Instructor Dashboard</h1>
            <SchoolSelectorBanner selectedSchoolId={overrideSchoolId} onSelect={setOverrideSchoolId} />
          </div>
        </AppShell>
      </Protected>
    );
  }

  if (!driverState.driver && status.startsWith('Loading')) {
    return (
      <Protected allowedRoles={['driver', 'school_admin', 'superadmin']}>
        <AppShell><PageLoading message="Loading instructor dashboard..." /></AppShell>
      </Protected>
    );
  }

  return (
    <Protected allowedRoles={['driver', 'school_admin', 'superadmin']}>
      <AppShell>
        <div className="space-y-4">
          <SchoolSelectorBanner selectedSchoolId={overrideSchoolId} onSelect={setOverrideSchoolId} />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Instructor Dashboard</h1>
            <p className="text-sm text-slate-800">
              Manage your schedule, view student profiles, and track your lessons.
            </p>
            <p className="text-xs text-slate-800">
              {driverState.driver ? `Active profile: ${driverState.driver.fullName}` : 'No driver profile loaded yet.'}
            </p>
            {actionMessage ? <p className="text-[11px] text-emerald-600 font-medium">{actionMessage}</p> : null}
          </div>

          {/* Overdue Bookings Alert */}
          {(() => {
            const overdue = driverState.bookings.filter(
              b => b.status === 'scheduled' && new Date(b.startTime).getTime() < Date.now()
            );
            if (overdue.length === 0) return null;
            return (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-amber-800 mb-2">
                  Attention: {overdue.length} lesson(s) past their scheduled time but still marked as &quot;scheduled&quot;
                </h2>
                <ul className="space-y-2">
                  {overdue.map(b => {
                    const overdueStudent = driverState.students.find(s => s.id === b.studentId) ?? null;
                    const studentName = overdueStudent?.fullName ?? 'Student';
                    return (
                      <li key={b.id} className="flex items-center justify-between bg-white border border-amber-200 rounded p-2">
                        <div>
                          <button
                            type="button"
                            className="text-sm font-medium text-slate-800 hover:text-blue-700 hover:underline text-left"
                            onClick={() => overdueStudent && setViewingStudent(overdueStudent)}
                          >
                            {studentName}
                          </button>
                          <p className="text-xs text-slate-800">{formatDateTime(b.startTime)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={markingCompleted}
                            onClick={() => markCompleted(b.id)}
                          >
                            {markingCompleted ? 'Completing...' : 'Mark Completed'}
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-500"
                            onClick={() => setConfirmCancel({ bookingId: b.id, studentName })}
                          >
                            Cancel
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          {/* Today's Schedule - Prominent at the top */}
          {upcomingLessons.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                🚗 Today&apos;s Schedule
                <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {upcomingLessons.filter(l => {
                    const lessonDate = toDateStringHalifax(l.rawStartTime);
                    const today = todayDateString();
                    return lessonDate === today;
                  }).length} lesson(s) today
                </span>
              </h2>
              <div className="space-y-3">
                {upcomingLessons
                  .filter(l => {
                    const lessonDate = toDateStringHalifax(l.rawStartTime);
                    const today = todayDateString();
                    return lessonDate === today;
                  })
                  .sort((a, b) => new Date(a.rawStartTime).getTime() - new Date(b.rawStartTime).getTime())
                  .map((lesson) => (
                    <div key={`today-${lesson.id}`} className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-semibold text-slate-900">
                              {formatTime(lesson.rawStartTime)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${lesson.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-800'
                              }`}>
                              {lesson.status}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="font-medium text-slate-800 hover:text-blue-700 hover:underline text-left"
                            onClick={() => {
                              const s = driverState.students.find((st) => st.id === lesson.studentId);
                              if (s) setViewingStudent(s);
                            }}
                          >
                            {lesson.student}
                          </button>
                          {lesson.pickupAddress && (
                            <p className="text-xs text-slate-800 mt-1">
                              📍 Pickup: {lesson.pickupAddress}
                            </p>
                          )}
                          {lesson.dropoffAddress && lesson.dropoffAddress !== lesson.pickupAddress && (
                            <p className="text-xs text-slate-800">
                              🏁 Dropoff: {lesson.dropoffAddress}
                            </p>
                          )}
                        </div>
                        <AddToCalendarButton
                          event={createDriverLessonEvent(
                            lesson.student,
                            new Date(lesson.rawStartTime),
                            new Date(new Date(lesson.rawStartTime).getTime() + (schoolSettings?.defaultLessonDurationMinutes ?? 90) * 60 * 1000),
                            lesson.pickupAddress,
                            lesson.dropoffAddress,
                          )}
                        />
                      </div>
                    </div>
                  ))}
                {upcomingLessons.filter(l => {
                  const lessonDate = toDateStringHalifax(l.rawStartTime);
                  const today = todayDateString();
                  return lessonDate === today;
                }).length === 0 && (
                    <p className="text-sm text-slate-800 text-center py-2">No lessons scheduled for today.</p>
                  )}
              </div>
            </div>
          )}

          {/* Overview Tab Content */}
          {activeTab === 'overview' && (
            <>
              {/* Contact Info */}
              <SummaryCard
                title="Contact Information"
                description="Your contact details visible to students."
                footer={driverState.driver?.phone || driverState.driver?.email ? 'Contact info on file' : 'No contact info yet'}
              >
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-800 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      className="w-full border rounded px-3 py-2 text-slate-900"
                      placeholder="+1 (902) 555-1234"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-800 mb-1">Contact Email</label>
                    <input
                      type="email"
                      className="w-full border rounded px-3 py-2 text-slate-900"
                      placeholder="instructor@example.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="w-full bg-slate-900 text-white font-medium rounded px-3 py-2 hover:bg-slate-800 disabled:opacity-50"
                    onClick={saveContactInfo}
                    disabled={isSavingContact}
                  >
                    {isSavingContact ? 'Saving...' : 'Save Contact Info'}
                  </button>
                </div>
              </SummaryCard>

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
                      ⚠️ Click on the map to set your location, adjust the radius, then click &quot;Save Service Center&quot; below.
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-slate-800 mb-1">
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
                      <div className="flex justify-between text-xs text-slate-800 mt-1">
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
                        <label className="block text-xs font-medium text-slate-800 mb-1">Start Time</label>
                        <input
                          type="time"
                          className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                          value={workingHours.start}
                          onChange={(e) => setWorkingHours({ ...workingHours, start: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-800 mb-1">End Time</label>
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
                    <p className="text-xs text-slate-800">
                      💡 Tip: You can also set specific availability for individual dates using the form below.
                    </p>
                  </div>
                </SummaryCard>
              </div>

              {/* Instructor Settings (School-level policies) */}
              <SummaryCard
                title="Instructor settings"
                description="Lead times, cancellation windows, and caps for your lessons."
                footer={`Current: lead time ${schoolSettings?.minBookingLeadTimeHours ?? '—'} hrs, cancellation cutoff ${schoolSettings?.cancellationCutoffHours ?? '—'} hrs`}
              >
                <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); saveSchoolSettings(); }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="text-xs text-slate-800">
                      Lead time (hrs)
                      <input
                        className="border rounded px-2 py-2 w-full text-slate-900"
                        type="number"
                        value={schoolSettingsForm.minBookingLeadTimeHours}
                        onChange={(e) => setSchoolSettingsForm({ ...schoolSettingsForm, minBookingLeadTimeHours: e.target.value })}
                        placeholder="24"
                      />
                    </label>
                    <label className="text-xs text-slate-800">
                      Cancellation cutoff (hrs)
                      <input
                        className="border rounded px-2 py-2 w-full text-slate-900"
                        type="number"
                        value={schoolSettingsForm.cancellationCutoffHours}
                        onChange={(e) => setSchoolSettingsForm({ ...schoolSettingsForm, cancellationCutoffHours: e.target.value })}
                        placeholder="24"
                      />
                    </label>
                    <label className="text-xs text-slate-800">
                      Lesson duration (min)
                      <input
                        className="border rounded px-2 py-2 w-full text-slate-900"
                        type="number"
                        value={schoolSettingsForm.defaultLessonDurationMinutes}
                        onChange={(e) => setSchoolSettingsForm({ ...schoolSettingsForm, defaultLessonDurationMinutes: e.target.value })}
                        placeholder="90"
                      />
                    </label>
                    <label className="text-xs text-slate-800">
                      Buffer between lessons (min)
                      <input
                        className="border rounded px-2 py-2 w-full text-slate-900"
                        type="number"
                        value={schoolSettingsForm.defaultBufferMinutesBetweenLessons}
                        onChange={(e) => setSchoolSettingsForm({ ...schoolSettingsForm, defaultBufferMinutesBetweenLessons: e.target.value })}
                        placeholder="15"
                      />
                    </label>
                    <label className="text-xs text-slate-800">
                      Daily booking cap
                      <input
                        className="border rounded px-2 py-2 w-full text-slate-900"
                        type="number"
                        value={schoolSettingsForm.dailyBookingCapPerDriver}
                        onChange={(e) => setSchoolSettingsForm({ ...schoolSettingsForm, dailyBookingCapPerDriver: e.target.value })}
                        placeholder="8"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingSchoolSettings}
                    className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSavingSchoolSettings ? 'Saving...' : 'Save settings'}
                  </button>
                </form>
              </SummaryCard>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SummaryCard
                  title="Availability grid"
                  description="Snapshot of 15-minute grid availability derived from your working hours."
                  footer={status || ''}
                >
                  <ul className="space-y-1 text-sm text-slate-800">
                    {availabilitySummary.map((slot) => (
                      <li key={`${slot.day}-${slot.window}`} className="flex justify-between">
                        <span>{slot.day}</span>
                        <span className="text-xs text-slate-800">{slot.window}</span>
                      </li>
                    ))}
                    {availabilitySummary.length === 0 && !status ? (
                      <li className="text-xs text-slate-800">No availability published yet.</li>
                    ) : null}
                  </ul>
                </SummaryCard>
                <SummaryCard
                  title="Upcoming lessons"
                  description="Your upcoming scheduled lessons."
                  footer={status || ''}
                >
                  <ul className="space-y-1 text-sm text-slate-800">
                    {upcomingLessons.map((lesson) => (
                      <li key={`${lesson.id}-${lesson.time}`} className="space-y-1 border rounded p-2 bg-slate-50">
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium text-slate-800">{lesson.time}</p>
                            <p className="text-xs text-slate-800">{lesson.status}</p>
                            <p className="text-[11px] text-slate-800">
                              Student:{' '}
                              <button
                                type="button"
                                className="hover:text-blue-700 hover:underline"
                                onClick={() => {
                                  const s = driverState.students.find((st) => st.id === lesson.studentId);
                                  if (s) setViewingStudent(s);
                                }}
                              >
                                {lesson.student}
                              </button>
                            </p>
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
                              new Date(new Date(lesson.rawStartTime).getTime() + (schoolSettings?.defaultLessonDurationMinutes ?? 90) * 60 * 1000),
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
                            min={new Date().toISOString().slice(0, 16)}
                          />
                          <button
                            className="px-3 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 min-h-[32px] disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => updateBooking(lesson.id, reschedule[lesson.id])}
                            type="button"
                            disabled={!reschedule[lesson.id] || isUpdatingBooking}
                          >
                            {isUpdatingBooking ? 'Rescheduling...' : 'Reschedule'}
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
                            className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-500 min-h-[32px] disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                            disabled={markingCompleted}
                            onClick={() => markCompleted(lesson.id)}
                          >
                            {markingCompleted ? 'Completing...' : '✓ Completed'}
                          </button>
                        </div>
                      </li>
                    ))}
                    {upcomingLessons.length === 0 && !status ? (
                      <li className="text-xs text-slate-800">No bookings scheduled yet.</li>
                    ) : null}
                  </ul>
                </SummaryCard>
              </div>

              {/* Earnings Card */}
              {driverState.driver && schoolId && token && (
                <EarningsCard
                  schoolId={schoolId}
                  driverId={driverState.driver.id}
                  token={token}
                />
              )}
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
                  lessonDurationMinutes={schoolSettings?.defaultLessonDurationMinutes ?? 90}
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
                              <span className="text-slate-800 block">Full Name</span>
                              <p className="font-semibold text-slate-900">{selectedStudent.fullName}</p>
                            </div>
                            <div>
                              <span className="text-slate-800 block">Age</span>
                              <p className="font-semibold text-slate-900">
                                {studentAge !== null ? `${studentAge} years old` : 'Not provided'}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-800 block">Date of Birth</span>
                              <p className="font-semibold text-slate-900">
                                {selectedStudent.dateOfBirth
                                  ? formatDate(selectedStudent.dateOfBirth)
                                  : 'Not provided'}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-800 block">Phone</span>
                              <p className="font-semibold text-slate-900">
                                {selectedStudent.phone ? (
                                  <a href={`tel:${selectedStudent.phone}`} className="text-blue-600 hover:underline">
                                    {selectedStudent.phone}
                                  </a>
                                ) : 'Not provided'}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-800 block">Email</span>
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
                                  ? formatDate(selectedStudent.licenceExpiryDate)
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
                                      <p className="text-slate-800">{addr.line1}</p>
                                      {addr.line2 && <p className="text-slate-800">{addr.line2}</p>}
                                      <p className="text-slate-800">
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
                                      <p className="font-medium text-slate-900">{formatDate(booking.startTime)}</p>
                                      <p className="text-slate-800">
                                        {formatTime(booking.startTime)}
                                      </p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${booking.status === 'completed' ? 'bg-green-100 text-green-800'
                                      : booking.status === 'scheduled' ? 'bg-blue-100 text-blue-800'
                                        : booking.status.includes('cancelled') ? 'bg-red-100 text-red-800'
                                          : 'bg-slate-100 text-slate-800'
                                      }`}>
                                      {booking.status.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-800 text-center py-4">No lesson history for this student.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {!selectedStudentId && (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">👥</p>
                      <p className="text-sm text-slate-800">
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
                      <label className="block text-xs font-medium text-slate-800 mb-1">Start Date</label>
                      <input
                        className="w-full border rounded px-2 py-2 text-slate-900"
                        type="date"
                        value={availabilityForm.dateStart}
                        onChange={(e) => setAvailabilityForm({ ...availabilityForm, dateStart: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-800 mb-1">End Date (optional)</label>
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
                      <label className="block text-xs font-medium text-slate-800 mb-1">Start Time</label>
                      <input
                        className="w-full border rounded px-2 py-2 text-slate-900"
                        type="time"
                        value={availabilityForm.startTime}
                        onChange={(e) => setAvailabilityForm({ ...availabilityForm, startTime: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-800 mb-1">End Time</label>
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
                  <h4 className="text-sm font-medium text-slate-800 mb-2">
                    📋 Published Availability ({driverState.availability.filter(a => a.type === 'working_hours').length} slot(s))
                  </h4>
                  <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                    {driverState.availability
                      .filter(a => a.type === 'working_hours')
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((slot) => (
                        <li key={slot.id} className="flex justify-between items-center border rounded p-2 bg-green-50">
                          <div>
                            <span className="font-medium text-slate-800">{formatDate(slot.date)}</span>
                            <span className="text-xs text-slate-800 ml-2">
                              {slot.startTime} - {slot.endTime}
                            </span>
                            <span className="text-xs text-green-700 font-medium ml-2">✓ Available</span>
                          </div>
                          <button
                            className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                            onClick={() => setConfirmDeleteSlot({ id: slot.id, date: formatDate(slot.date) })}
                          >
                            🗑️ Remove
                          </button>
                        </li>
                      ))}
                    {driverState.availability.filter(a => a.type === 'working_hours').length === 0 ? (
                      <li className="text-xs text-slate-800 text-center py-2">
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
                      <label className="block text-xs font-medium text-slate-800 mb-1">Start Date</label>
                      <input
                        className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                        type="date"
                        value={holidayRange.start}
                        onChange={(e) => setHolidayRange({ ...holidayRange, start: e.target.value })}
                        required
                        min={todayDateString()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-800 mb-1">End Date (optional)</label>
                      <input
                        className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                        type="date"
                        value={holidayRange.end}
                        onChange={(e) => setHolidayRange({ ...holidayRange, end: e.target.value })}
                        min={holidayRange.start || todayDateString()}
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
                          <span className="font-medium text-slate-800">{formatDate(holiday.date)}</span>
                          <span className="text-xs text-red-700 font-medium ml-2">⛔ Unavailable</span>
                        </div>
                        <button
                          className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                          onClick={() => setConfirmDeleteBlock({ id: holiday.id, date: formatDate(holiday.date) })}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  {driverState.availability.filter(a => a.type === 'override_closed').length === 0 ? (
                    <li className="text-xs text-slate-800 text-center py-2">No time off scheduled.</li>
                  ) : null}
                </ul>
              </SummaryCard>
              <SummaryCard
                title="Lesson History"
                description="Your completed and cancelled lessons."
                footer={`${driverState.pastBookings.length} past lesson(s)`}
              >
                <ul className="space-y-2 text-sm text-slate-800 max-h-64 overflow-y-auto">
                  {driverState.pastBookings.map((booking) => (
                    <li key={booking.id} className="border rounded p-3 bg-slate-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{formatDate(booking.startTime)}</p>
                          <p className="text-xs text-slate-800">
                            {formatTime(booking.startTime)}
                            {' - '}
                            <button
                              type="button"
                              className="hover:text-blue-700 hover:underline"
                              onClick={() => {
                                const s = driverState.students.find((st) => st.id === booking.studentId);
                                if (s) setViewingStudent(s);
                              }}
                            >
                              {driverState.students.find((s) => s.id === booking.studentId)?.fullName ?? 'Unknown Student'}
                            </button>
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${booking.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-800'
                          }`}>
                          {booking.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </li>
                  ))}
                  {driverState.pastBookings.length === 0 ? (
                    <li className="text-xs text-slate-800 text-center py-4">No lesson history yet.</li>
                  ) : null}
                </ul>
              </SummaryCard>
            </>
          )}
        </div>
      </AppShell>

      {/* Student Profile Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewingStudent(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold text-slate-900">Student Profile</h3>
              <button type="button" onClick={() => setViewingStudent(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold">
                {viewingStudent.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-medium text-slate-900">{viewingStudent.fullName}</p>
                {viewingStudent.isMinor && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Minor</span>
                )}
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {viewingStudent.phone && (
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 w-5 text-center">&#128222;</span>
                  <a href={`tel:${viewingStudent.phone}`} className="text-blue-700 hover:underline">{viewingStudent.phone}</a>
                </div>
              )}
              {viewingStudent.email && (
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 w-5 text-center">&#9993;</span>
                  <a href={`mailto:${viewingStudent.email}`} className="text-blue-700 hover:underline">{viewingStudent.email}</a>
                </div>
              )}
              {viewingStudent.isMinor && viewingStudent.guardianPhone && (
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 w-5 text-center">&#128106;</span>
                  <span className="text-slate-600">Guardian: </span>
                  <a href={`tel:${viewingStudent.guardianPhone}`} className="text-blue-700 hover:underline">{viewingStudent.guardianPhone}</a>
                </div>
              )}
              {viewingStudent.isMinor && viewingStudent.guardianEmail && (
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 w-5 text-center">&#9993;</span>
                  <span className="text-slate-600">Guardian: </span>
                  <a href={`mailto:${viewingStudent.guardianEmail}`} className="text-blue-700 hover:underline">{viewingStudent.guardianEmail}</a>
                </div>
              )}
              {!viewingStudent.phone && !viewingStudent.email && (
                <p className="text-slate-500 text-sm">No contact information available yet.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setViewingStudent(null)}
              className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm font-medium hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

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

      {/* Confirmation Dialog for removing availability slot */}
      <ConfirmDialog
        isOpen={confirmDeleteSlot !== null}
        title="Remove Availability"
        message={confirmDeleteSlot ? `Remove your availability on ${confirmDeleteSlot.date}? Students will no longer be able to book this slot.` : ''}
        confirmLabel="Yes, Remove"
        cancelLabel="Keep It"
        variant="warning"
        onConfirm={() => {
          if (confirmDeleteSlot) {
            removeAvailabilitySlot(confirmDeleteSlot.id);
            setConfirmDeleteSlot(null);
          }
        }}
        onCancel={() => setConfirmDeleteSlot(null)}
      />

      {/* Confirmation Dialog for removing blocked date */}
      <ConfirmDialog
        isOpen={confirmDeleteBlock !== null}
        title="Remove Block"
        message={confirmDeleteBlock ? `Remove the block on ${confirmDeleteBlock.date}? You will become available for bookings on this date.` : ''}
        confirmLabel="Yes, Remove Block"
        cancelLabel="Keep Blocked"
        variant="info"
        onConfirm={() => {
          if (confirmDeleteBlock) {
            removeHoliday(confirmDeleteBlock.id);
            setConfirmDeleteBlock(null);
          }
        }}
        onCancel={() => setConfirmDeleteBlock(null)}
      />
    </Protected>
  );
}
