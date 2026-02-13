'use client';

import toast from 'react-hot-toast';
import React, { useEffect, useMemo, useState } from 'react';
import { Protected } from '../auth/Protected';
import { AppShell } from '../components/AppShell';
import { SummaryCard } from '../components/SummaryCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AnalyticsDashboard, AdminTab } from '../components/AnalyticsDashboard';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch, ApiError } from '../apiClient';
import { PageLoading } from '../components/LoadingSpinner';

type SchoolSettings = {
  id: number;
  minBookingLeadTimeHours: number | null;
  cancellationCutoffHours: number | null;
  defaultLessonDurationMinutes: number | null;
  defaultBufferMinutesBetweenLessons: number | null;
  defaultServiceRadiusKm: string | null;
  defaultMaxSegmentTravelTimeMin: number | null;
  defaultMaxSegmentTravelDistanceKm: string | null;
  defaultDailyMaxTravelTimeMin: number | null;
  defaultDailyMaxTravelDistanceKm: string | null;
  dailyBookingCapPerDriver: number | null;
  allowStudentToPickDriver: boolean;
  allowDriverSelfAvailabilityEdit: boolean;
};

type Driver = { id: number; fullName: string; active: boolean };
type Student = {
  id: number;
  fullName: string;
  licenceStatus: string;
  licenceNumber?: string | null;
  licenceImageUrl?: string | null;
  licenceExpiryDate?: string | null;
  licenceProvinceOrState?: string | null;
  active: boolean;
};
type Booking = { id: number; studentId: number; driverId: number; status: string; startTime: string };
type DriverHoliday = { id: number; driverId: number; driverName: string; date: string; notes: string | null };
type PendingInvitation = { id: number; email: string; role: string; fullName: string | null; expiresAt: string; createdAt: string };

export default function AdminPage() {
  const { token, user } = useAuth();
  const schoolId = useMemo(() => user?.schoolId, [user?.schoolId]);

  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverHolidays, setDriverHolidays] = useState<DriverHoliday[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [confirmCancelInvitation, setConfirmCancelInvitation] = useState<number | null>(null);
  const [isCancellingInvitation, setIsCancellingInvitation] = useState(false);

  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
  const isSuperadmin = user?.role === 'superadmin';

  const [driverForm, setDriverForm] = useState({ email: '', fullName: '' });
  const [studentForm, setStudentForm] = useState({
    email: '',
    fullName: '',
    allowedHours: '',
    maxLessonsPerDay: '1',
    schoolId: '',
  });
  const [settingsForm, setSettingsForm] = useState({
    minBookingLeadTimeHours: '',
    cancellationCutoffHours: '',
    defaultLessonDurationMinutes: '',
    defaultBufferMinutesBetweenLessons: '',
    defaultServiceRadiusKm: '',
    defaultMaxSegmentTravelTimeMin: '',
    defaultMaxSegmentTravelDistanceKm: '',
    defaultDailyMaxTravelTimeMin: '',
    defaultDailyMaxTravelDistanceKm: '',
    dailyBookingCapPerDriver: '',
    allowStudentToPickDriver: true,
    allowDriverSelfAvailabilityEdit: true,
  });
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleDriverId, setRescheduleDriverId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  async function loadSettings() {
    if (!token || !schoolId) { setLoadingSettings(false); return; }
    setLoadingSettings(true);
    setError(null);
    try {
      const loadedSettings = await apiFetch<SchoolSettings>(`/schools/${schoolId}/settings`, token);
      setSettings(loadedSettings);
      setSettingsForm({
        minBookingLeadTimeHours: loadedSettings.minBookingLeadTimeHours?.toString() ?? '',
        cancellationCutoffHours: loadedSettings.cancellationCutoffHours?.toString() ?? '',
        defaultLessonDurationMinutes: loadedSettings.defaultLessonDurationMinutes?.toString() ?? '',
        defaultBufferMinutesBetweenLessons: loadedSettings.defaultBufferMinutesBetweenLessons?.toString() ?? '',
        defaultServiceRadiusKm: loadedSettings.defaultServiceRadiusKm ?? '',
        defaultMaxSegmentTravelTimeMin: loadedSettings.defaultMaxSegmentTravelTimeMin?.toString() ?? '',
        defaultMaxSegmentTravelDistanceKm: loadedSettings.defaultMaxSegmentTravelDistanceKm ?? '',
        defaultDailyMaxTravelTimeMin: loadedSettings.defaultDailyMaxTravelTimeMin?.toString() ?? '',
        defaultDailyMaxTravelDistanceKm: loadedSettings.defaultDailyMaxTravelDistanceKm ?? '',
        dailyBookingCapPerDriver: loadedSettings.dailyBookingCapPerDriver?.toString() ?? '',
        allowStudentToPickDriver: loadedSettings.allowStudentToPickDriver,
        allowDriverSelfAvailabilityEdit: loadedSettings.allowDriverSelfAvailabilityEdit,
      });
    } catch (err) {
      setError('Unable to load school settings. Ensure backend is running and your token is valid.');
    } finally {
      setLoadingSettings(false);
    }
  }

  async function loadRoster() {
    if (!token || !schoolId) { setLoadingRoster(false); return; }
    setLoadingRoster(true);
    setError(null);
    try {
      const [driverResults, studentResults] = await Promise.all([
        apiFetch<Driver[]>(`/schools/${schoolId}/drivers`, token),
        apiFetch<Student[]>(`/schools/${schoolId}/students`, token),
      ]);
      setDrivers(driverResults);
      setStudents(studentResults);
    } catch (err) {
      setError('Unable to load drivers or students. Check your token and backend availability.');
    } finally {
      setLoadingRoster(false);
    }
  }

  async function loadBookings() {
    if (!token || !schoolId) return;
    setLoadingBookings(true);
    setError(null);
    try {
      const bookingResults = await apiFetch<Booking[]>(`/schools/${schoolId}/bookings`, token);
      setBookings(bookingResults);
      if (!selectedBookingId && bookingResults.length > 0) {
        setSelectedBookingId(bookingResults[0].id);
      }
    } catch (err) {
      setError('Unable to load bookings.');
    } finally {
      setLoadingBookings(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, [schoolId, token]);

  useEffect(() => {
    loadRoster();
  }, [schoolId, token]);

  useEffect(() => {
    loadBookings();
  }, [schoolId, token]);

  useEffect(() => {
    if (!token || !isSuperadmin) return;
    apiFetch<{ id: number; name: string }[]>('/schools', token)
      .then(setSchools)
      .catch(() => {});
  }, [token, isSuperadmin]);

  // Phase 3: Load driver holidays
  async function loadDriverHolidays() {
    if (!token || !schoolId) return;
    try {
      const holidays = await apiFetch<DriverHoliday[]>(`/schools/${schoolId}/drivers/holidays`, token);
      setDriverHolidays(holidays);
    } catch (err) {
      console.error('Unable to load driver holidays');
    }
  }

  // Phase 3: Load pending invitations
  async function loadPendingInvitations() {
    if (!token || !schoolId) return;
    try {
      const invitations = await apiFetch<PendingInvitation[]>(`/schools/${schoolId}/invitations/pending`, token);
      setPendingInvitations(invitations);
    } catch (err) {
      console.error('Unable to load pending invitations');
    }
  }

  // Phase 3: Resend invitation
  async function handleResendInvitation(invitationId: number) {
    if (!token || !schoolId) return;
    const toastId = toast.loading('Resending invitation...');
    try {
      await apiFetch(`/schools/${schoolId}/invitations/${invitationId}/resend`, token, {
        method: 'POST',
      });
      await loadPendingInvitations();
      toast.success('Invitation resent!', { id: toastId });
    } catch (err) {
      toast.error('Unable to resend invitation.', { id: toastId });
    }
  }

  // Phase 3: Cancel invitation
  async function handleCancelInvitation(invitationId: number) {
    if (!token || !schoolId) return;
    setIsCancellingInvitation(true);
    const toastId = toast.loading('Cancelling invitation...');
    try {
      await apiFetch(`/schools/${schoolId}/invitations/${invitationId}`, token, {
        method: 'DELETE',
      });
      await loadPendingInvitations();
      toast.success('Invitation cancelled.', { id: toastId });
    } catch (err) {
      toast.error('Unable to cancel invitation.', { id: toastId });
    } finally {
      setIsCancellingInvitation(false);
      setConfirmCancelInvitation(null);
    }
  }

  useEffect(() => {
    loadDriverHolidays();
    loadPendingInvitations();

    // Auto-refresh pending invitations every 30 seconds
    const interval = setInterval(() => {
      loadPendingInvitations();
    }, 30000);
    return () => clearInterval(interval);
  }, [schoolId, token]);

  async function handleCreateDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(driverForm.email)) {
      setFormErrors({ ...formErrors, driverEmail: 'Please enter a valid email address' });
      return;
    }
    setFormErrors({ ...formErrors, driverEmail: '' });

    const toastId = toast.loading('Sending invitation...');
    try {
      await apiFetch(`/schools/${schoolId}/invitations`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: driverForm.email,
          role: 'DRIVER',
          fullName: driverForm.fullName || undefined,
        }),
      });
      setDriverForm({ email: '', fullName: '' });
      await loadPendingInvitations();
      toast.success('Invitation sent! Driver will receive an email.', { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send invitation';
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('exists')) {
        setFormErrors({ ...formErrors, driverEmail: 'This email already has an account or pending invitation' });
      }
      toast.error(message, { id: toastId });
    }
  }

  async function handleCreateStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetSchoolId = isSuperadmin ? Number(studentForm.schoolId) : schoolId;
    if (!token || !targetSchoolId) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentForm.email)) {
      setFormErrors({ ...formErrors, studentEmail: 'Please enter a valid email address' });
      return;
    }
    setFormErrors({ ...formErrors, studentEmail: '' });

    const toastId = toast.loading('Sending invitation...');
    try {
      await apiFetch(`/schools/${targetSchoolId}/invitations`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: studentForm.email,
          role: 'STUDENT',
          fullName: studentForm.fullName || undefined,
          allowedHours: studentForm.allowedHours ? Number(studentForm.allowedHours) : undefined,
          maxLessonsPerDay: studentForm.maxLessonsPerDay ? Number(studentForm.maxLessonsPerDay) : 1,
        }),
      });
      setStudentForm({ email: '', fullName: '', allowedHours: '', maxLessonsPerDay: '1', schoolId: studentForm.schoolId });
      toast.success('Invitation sent! Student will receive an email.', { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send invitation';
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('exists')) {
        setFormErrors({ ...formErrors, studentEmail: 'This email already has an account or pending invitation' });
      }
      toast.error(message, { id: toastId });
    }
  }

  async function handleUpdateSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId) return;
    const toastId = toast.loading('Saving settings...');
    try {
      await apiFetch(`/schools/${schoolId}/settings`, token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minBookingLeadTimeHours: settingsForm.minBookingLeadTimeHours
            ? Number(settingsForm.minBookingLeadTimeHours)
            : null,
          cancellationCutoffHours: settingsForm.cancellationCutoffHours
            ? Number(settingsForm.cancellationCutoffHours)
            : null,
          defaultLessonDurationMinutes: settingsForm.defaultLessonDurationMinutes
            ? Number(settingsForm.defaultLessonDurationMinutes)
            : null,
          defaultBufferMinutesBetweenLessons: settingsForm.defaultBufferMinutesBetweenLessons
            ? Number(settingsForm.defaultBufferMinutesBetweenLessons)
            : null,
          defaultMaxSegmentTravelTimeMin: settingsForm.defaultMaxSegmentTravelTimeMin
            ? Number(settingsForm.defaultMaxSegmentTravelTimeMin)
            : null,
          defaultMaxSegmentTravelDistanceKm: settingsForm.defaultMaxSegmentTravelDistanceKm || null,
          defaultDailyMaxTravelTimeMin: settingsForm.defaultDailyMaxTravelTimeMin
            ? Number(settingsForm.defaultDailyMaxTravelTimeMin)
            : null,
          defaultDailyMaxTravelDistanceKm: settingsForm.defaultDailyMaxTravelDistanceKm || null,
          dailyBookingCapPerDriver: settingsForm.dailyBookingCapPerDriver
            ? Number(settingsForm.dailyBookingCapPerDriver)
            : null,
        }),
      });
      await loadSettings();
      toast.success('Settings saved!', { id: toastId });
    } catch (err) {
      toast.error('Unable to save settings.', { id: toastId });
    }
  }

  async function handleReschedule(event: React.FormEvent<HTMLFormElement>, force = false) {
    event.preventDefault();
    if (!token || !schoolId || !selectedBookingId) return;
    const toastId = toast.loading('Updating booking...');
    try {
      const patch: Record<string, string | number | boolean> = {};
      if (rescheduleStart) patch.startTime = new Date(rescheduleStart).toISOString();
      if (rescheduleDriverId) patch.driverId = Number(rescheduleDriverId);
      if (force) patch.force = true;
      await apiFetch(`/schools/${schoolId}/bookings/${selectedBookingId}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setRescheduleStart('');
      setRescheduleDriverId('');
      await loadBookings();
      toast.success('Booking updated!', { id: toastId });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'REQUIRES_FORCE') {
        toast.dismiss(toastId);
        const confirmed = window.confirm(
          `${err.message}\n\nDo you want to proceed anyway?`
        );
        if (confirmed) {
          handleReschedule(event, true);
        }
        return;
      }
      toast.error('Unable to update booking.', { id: toastId });
    }
  }

  async function handleCancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId || !selectedBookingId) return;
    const toastId = toast.loading('Cancelling booking...');
    try {
      await apiFetch(`/schools/${schoolId}/bookings/${selectedBookingId}/cancel`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode: cancelReason || undefined }),
      });
      setCancelReason('');
      await loadBookings();
      toast.success('Booking cancelled.', { id: toastId });
    } catch (err) {
      toast.error('Unable to cancel booking.', { id: toastId });
    }
  }

  async function updateLicenceStatus(studentId: number, newStatus: 'approved' | 'rejected' | 'pending_review', note?: string) {
    if (!token || !schoolId) return;
    const toastId = toast.loading(`Updating licence status...`);
    try {
      await apiFetch(`/schools/${schoolId}/students/${studentId}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenceStatus: newStatus,
          licenceRejectionNote: newStatus === 'rejected' ? (note || undefined) : null,
        }),
      });
      await loadRoster();
      setSelectedStudent(null);
      setRejectionNote('');
      toast.success(`Licence ${newStatus}!`, { id: toastId });
    } catch (err) {
      toast.error('Unable to update licence status.', { id: toastId });
    }
  }

  if ((loadingSettings || loadingRoster) && !settings) {
    return (
      <Protected allowedRoles={['superadmin', 'school_admin']}>
        <AppShell><PageLoading message="Loading admin workspace..." /></AppShell>
      </Protected>
    );
  }

  return (
    <Protected allowedRoles={['superadmin', 'school_admin']}>
      <AppShell>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">School Admin workspace</h1>
            <p className="text-sm text-slate-800">
              Manage your school roster, policies, and bookings. Backend calls are scoped using your JWT school ID.
            </p>
            {actionMessage ? <p className="text-xs text-slate-800 mt-1">{actionMessage}</p> : null}
            {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
          </div>

          {/* Analytics Dashboard */}
          {schoolId && token && (
            <AnalyticsDashboard schoolId={schoolId} token={token} activeTab={activeTab} onTabChange={setActiveTab} />
          )}

          {/* Drivers Tab Content */}
          {activeTab === 'drivers' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard
              title="Drivers"
              description="Onboard instructors and monitor their status."
              footer={loadingRoster ? 'Loading drivers…' : error ?? 'Data comes from /schools/:id/drivers'}
            >
              <ul className="space-y-1 text-sm text-slate-800">
                {drivers.map((driver) => (
                  <li key={driver.id} className="flex justify-between">
                    <span>{driver.fullName}</span>
                    <span className="text-xs text-slate-800">{driver.active ? 'active' : 'inactive'}</span>
                  </li>
                ))}
                {drivers.length === 0 && !loadingRoster ? (
                  <li className="text-xs text-slate-800">No drivers yet.</li>
                ) : null}
              </ul>
              <form className="mt-3 space-y-2" onSubmit={handleCreateDriver}>
                <div className="text-xs font-medium text-slate-800 mb-1">Invite New Driver</div>
                <div>
                  <input
                    className={`border rounded px-3 py-2 text-sm w-full ${formErrors.driverEmail ? 'border-red-500 bg-red-50' : ''}`}
                    placeholder="Email *"
                    type="email"
                    value={driverForm.email}
                    onChange={(e) => {
                      setDriverForm({ ...driverForm, email: e.target.value });
                      if (formErrors.driverEmail) setFormErrors({ ...formErrors, driverEmail: '' });
                    }}
                    required
                  />
                  {formErrors.driverEmail && (
                    <p className="text-red-600 text-xs mt-1">{formErrors.driverEmail}</p>
                  )}
                </div>
                <input
                  className="border rounded px-3 py-2 text-sm w-full"
                  placeholder="Full name (optional)"
                  value={driverForm.fullName}
                  onChange={(e) => setDriverForm({ ...driverForm, fullName: e.target.value })}
                />
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white rounded px-3 py-2 text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  📧 Send Invitation
                </button>
              </form>
            </SummaryCard>

            {/* Phase 3: Driver Holidays Card */}
            <SummaryCard
              title="📅 Driver Holidays"
              description="Upcoming days when instructors are unavailable."
              footer={`${driverHolidays.length} upcoming holiday(s)`}
            >
              <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                {driverHolidays.map((holiday) => (
                  <li key={holiday.id} className="flex justify-between items-center border rounded p-2 bg-red-50">
                    <div>
                      <p className="font-medium">{holiday.driverName}</p>
                      <p className="text-xs text-slate-800">
                        {new Date(holiday.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">⛔ Off</span>
                  </li>
                ))}
                {driverHolidays.length === 0 ? (
                  <li className="text-xs text-slate-800 text-center py-4">No upcoming holidays.</li>
                ) : null}
              </ul>
            </SummaryCard>

            {/* Phase 3: Pending Invitations Card */}
            <SummaryCard
              title="✉️ Pending Invitations"
              description="Invitations awaiting acceptance. Auto-refreshes every 30s."
              footer={`${pendingInvitations.length} pending invite(s)`}
            >
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => loadPendingInvitations()}
                  className="text-xs px-2 py-1 bg-slate-100 text-slate-800 rounded hover:bg-slate-200"
                >
                  Refresh
                </button>
              </div>
              <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                {pendingInvitations.map((invite) => (
                  <li key={invite.id} className="border rounded p-2 bg-yellow-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-900">{invite.email}</p>
                        <p className="text-xs text-slate-800">
                          {invite.fullName || 'No name'} • {invite.role}
                        </p>
                        <p className="text-xs text-slate-800">
                          Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResendInvitation(invite.id)}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Resend
                        </button>
                        <button
                          onClick={() => setConfirmCancelInvitation(invite.id)}
                          className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
                {pendingInvitations.length === 0 ? (
                  <li className="text-xs text-slate-800 text-center py-4">No pending invitations.</li>
                ) : null}
              </ul>
            </SummaryCard>
          </div>
          )}

          {/* Overview Tab Content */}
          {activeTab === 'overview' && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SummaryCard
              title="Students & Licence Review"
              description="Click a student to review their licence and approve/reject."
              footer={loadingRoster ? 'Loading students…' : error ?? 'Data comes from /schools/:id/students'}
            >
              <ul className="space-y-2 text-sm">
                {students.map((student) => (
                  <li
                    key={student.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${student.licenceStatus === 'approved'
                      ? 'bg-green-50 border-green-200 hover:border-green-400'
                      : student.licenceStatus === 'rejected'
                        ? 'bg-red-50 border-red-200 hover:border-red-400'
                        : 'bg-yellow-50 border-yellow-200 hover:border-yellow-400'
                      }`}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-slate-800">{student.fullName}</p>
                        <p className="text-xs text-slate-800">
                          Licence: {student.licenceNumber ?? 'Not provided'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${student.licenceStatus === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : student.licenceStatus === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {student.licenceStatus === 'approved' ? '✓' : student.licenceStatus === 'rejected' ? '✗' : '⏳'}
                          {student.licenceStatus}
                        </span>
                        <p className="text-xs text-slate-800 mt-1">Click to review</p>
                      </div>
                    </div>
                  </li>
                ))}
                {students.length === 0 && !loadingRoster ? (
                  <li className="text-xs text-slate-800 text-center py-4">No students yet.</li>
                ) : null}
              </ul>

              {/* Licence Review Modal */}
              {selectedStudent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold">Licence Review</h3>
                        <button
                          onClick={() => setSelectedStudent(null)}
                          className="text-slate-800 hover:text-slate-800 text-xl leading-none"
                        >×</button>
                      </div>

                      <div className="space-y-4">
                        <div className="border-b pb-4">
                          <p className="text-sm text-slate-800">Student</p>
                          <p className="font-medium text-lg">{selectedStudent.fullName}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-800">Licence Number</p>
                            <p className="font-medium">{selectedStudent.licenceNumber ?? 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-slate-800">Province/State</p>
                            <p className="font-medium">{selectedStudent.licenceProvinceOrState ?? 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-slate-800">Expiry Date</p>
                            <p className="font-medium">
                              {selectedStudent.licenceExpiryDate
                                ? new Date(selectedStudent.licenceExpiryDate).toLocaleDateString()
                                : 'Not provided'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-800">Current Status</p>
                            <p className={`font-medium ${selectedStudent.licenceStatus === 'approved' ? 'text-green-600'
                              : selectedStudent.licenceStatus === 'rejected' ? 'text-red-600'
                                : 'text-yellow-600'
                              }`}>
                              {selectedStudent.licenceStatus}
                            </p>
                          </div>
                        </div>

                        {/* Licence Image */}
                        <div>
                          <p className="text-sm text-slate-800 mb-2">Licence Image</p>
                          {selectedStudent.licenceImageUrl ? (
                            <img
                              src={selectedStudent.licenceImageUrl}
                              alt="Licence"
                              className="w-full max-h-48 object-contain border rounded-lg bg-slate-50"
                            />
                          ) : (
                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center text-slate-800">
                              No licence image uploaded
                            </div>
                          )}
                        </div>

                        {/* Rejection Note Input */}
                        <div className="pt-4 border-t">
                          <label className="block text-xs font-medium text-slate-800 mb-1">
                            Rejection Note (optional)
                          </label>
                          <textarea
                            value={rejectionNote}
                            onChange={(e) => setRejectionNote(e.target.value)}
                            placeholder="Provide a reason if rejecting (will be shown to student)"
                            className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                          <button
                            onClick={() => updateLicenceStatus(selectedStudent.id, 'approved')}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => updateLicenceStatus(selectedStudent.id, 'rejected', rejectionNote)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
                          >
                            ✗ Reject
                          </button>
                          <button
                            onClick={() => updateLicenceStatus(selectedStudent.id, 'pending_review')}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg px-4 py-2 text-sm font-medium"
                          >
                            ⏳ Pending
                          </button>
                        </div>
                        <button
                          onClick={() => setSelectedStudent(null)}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg px-4 py-2 text-sm"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <form className="mt-3 space-y-3" onSubmit={handleCreateStudent}>
                <div className="text-xs font-medium text-slate-800 mb-1">Invite New Student</div>
                {isSuperadmin && (
                  <select
                    className="border rounded px-3 py-2 text-sm w-full text-slate-900"
                    value={studentForm.schoolId}
                    onChange={(e) => setStudentForm({ ...studentForm, schoolId: e.target.value })}
                    required
                  >
                    <option value="">Select school *</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
                <div>
                  <input
                    className={`border rounded px-3 py-2 text-sm w-full ${formErrors.studentEmail ? 'border-red-500 bg-red-50' : ''}`}
                    placeholder="Email *"
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => {
                      setStudentForm({ ...studentForm, email: e.target.value });
                      if (formErrors.studentEmail) setFormErrors({ ...formErrors, studentEmail: '' });
                    }}
                    required
                  />
                  {formErrors.studentEmail && (
                    <p className="text-red-600 text-xs mt-1">{formErrors.studentEmail}</p>
                  )}
                </div>
                <input
                  className="border rounded px-3 py-2 text-sm w-full"
                  placeholder="Full name (optional)"
                  value={studentForm.fullName}
                  onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-800">Allowed Hours</label>
                    <input
                      className="border rounded px-3 py-2 text-sm w-full mt-1"
                      placeholder="e.g. 10"
                      type="number"
                      min="1"
                      value={studentForm.allowedHours}
                      onChange={(e) => setStudentForm({ ...studentForm, allowedHours: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-800">Max Lessons/Day</label>
                    <input
                      className="border rounded px-3 py-2 text-sm w-full mt-1"
                      placeholder="e.g. 1"
                      type="number"
                      min="1"
                      max="5"
                      value={studentForm.maxLessonsPerDay}
                      onChange={(e) => setStudentForm({ ...studentForm, maxLessonsPerDay: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white rounded px-3 py-2 text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  📧 Send Invitation
                </button>
              </form>
            </SummaryCard>
            <SummaryCard
              title="School settings"
              description="Lead times, cancellation windows, and caps pulled from the backend."
              footer={loadingSettings ? 'Loading settings...' : error ?? 'Data comes from /schools/:id/settings'}
            >
              <form className="space-y-2 text-sm" onSubmit={handleUpdateSettings}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs text-slate-800">
                    Lead time (hrs)
                    <input
                      className="border rounded px-2 py-1 w-full"
                      type="number"
                      value={settingsForm.minBookingLeadTimeHours}
                      onChange={(e) => setSettingsForm({ ...settingsForm, minBookingLeadTimeHours: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-slate-800">
                    Cancellation cutoff (hrs)
                    <input
                      className="border rounded px-2 py-1 w-full"
                      type="number"
                      value={settingsForm.cancellationCutoffHours}
                      onChange={(e) => setSettingsForm({ ...settingsForm, cancellationCutoffHours: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-slate-800">
                    Lesson duration (min)
                    <input
                      className="border rounded px-2 py-1 w-full"
                      type="number"
                      value={settingsForm.defaultLessonDurationMinutes}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, defaultLessonDurationMinutes: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-800">
                    Buffer between lessons (min)
                    <input
                      className="border rounded px-2 py-1 w-full"
                      type="number"
                      value={settingsForm.defaultBufferMinutesBetweenLessons}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, defaultBufferMinutesBetweenLessons: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-800">
                    Daily booking cap
                    <input
                      className="border rounded px-2 py-1 w-full"
                      type="number"
                      value={settingsForm.dailyBookingCapPerDriver}
                      onChange={(e) => setSettingsForm({ ...settingsForm, dailyBookingCapPerDriver: e.target.value })}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm hover:bg-slate-800"
                >
                  Save settings
                </button>
                <p className="text-[11px] text-slate-800">
                  Current values: lead time {settings?.minBookingLeadTimeHours ?? '—'} hrs, cancellation cutoff{' '}
                  {settings?.cancellationCutoffHours ?? '—'} hrs.
                </p>
              </form>
            </SummaryCard>
          </div>
          <SummaryCard
            title="Bookings overview"
            description="Slots and policies are enforced server-side; this view surfaces current states."
            footer={loadingBookings ? 'Loading bookings…' : error ?? 'Data comes from /schools/:id/bookings'}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {bookings.map((booking) => {
                const driverName = drivers.find((driver) => driver.id === booking.driverId)?.fullName ?? 'Driver';
                const studentName = students.find((student) => student.id === booking.studentId)?.fullName ?? 'Student';

                return (
                  <div key={booking.id} className="border rounded p-3 bg-slate-50">
                    <p className="font-medium text-slate-800">
                      {studentName} with {driverName}
                    </p>
                    <p className="text-xs text-slate-800">{booking.status}</p>
                    <p className="text-xs text-slate-800">Starts at {new Date(booking.startTime).toLocaleString()}</p>
                  </div>
                );
              })}
              {bookings.length === 0 && !loadingBookings ? (
                <p className="text-xs text-slate-800">No bookings found for this school.</p>
              ) : null}
            </div>

            {bookings.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <form className="space-y-2" onSubmit={handleReschedule}>
                  <h3 className="text-sm font-semibold">Reschedule booking</h3>
                  <select
                    className="border rounded px-2 py-1 w-full text-slate-900"
                    value={selectedBookingId ?? ''}
                    onChange={(e) => setSelectedBookingId(Number(e.target.value))}
                  >
                    {bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        #{booking.id} · {new Date(booking.startTime).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <input
                    className="border rounded px-2 py-1 w-full text-slate-900"
                    type="datetime-local"
                    value={rescheduleStart}
                    onChange={(e) => setRescheduleStart(e.target.value)}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <select
                    className="border rounded px-2 py-1 w-full text-slate-900"
                    value={rescheduleDriverId}
                    onChange={(e) => setRescheduleDriverId(e.target.value)}
                  >
                    <option value="">Keep assigned driver</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.fullName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="w-full bg-slate-900 text-white rounded px-3 py-2 hover:bg-slate-800"
                  >
                    Save new time
                  </button>
                </form>
                <form className="space-y-2" onSubmit={handleCancel}>
                  <h3 className="text-sm font-semibold">Cancel booking</h3>
                  <select
                    className="border rounded px-2 py-1 w-full text-slate-900"
                    value={selectedBookingId ?? ''}
                    onChange={(e) => setSelectedBookingId(Number(e.target.value))}
                  >
                    {bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        #{booking.id} · {new Date(booking.startTime).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <input
                    className="border rounded px-2 py-1 w-full text-slate-900"
                    placeholder="Reason code (optional)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="w-full bg-red-600 text-white rounded px-3 py-2 hover:bg-red-500"
                  >
                    Cancel booking
                  </button>
                </form>
              </div>
            ) : null}
          </SummaryCard>
          </>
          )}
        </div>
      </AppShell>

      {/* Cancel Invitation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmCancelInvitation !== null}
        title="Cancel Invitation"
        message="Are you sure you want to cancel this invitation? The invitee will not be able to register."
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep Invitation"
        variant="warning"
        loading={isCancellingInvitation}
        onConfirm={() => confirmCancelInvitation && handleCancelInvitation(confirmCancelInvitation)}
        onCancel={() => setConfirmCancelInvitation(null)}
      />
    </Protected>
  );
}
