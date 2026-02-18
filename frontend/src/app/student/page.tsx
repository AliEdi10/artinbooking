'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import toast from 'react-hot-toast';
import React, { useEffect, useMemo, useState } from 'react';
import { Protected } from '../auth/Protected';
import { AppShell } from '../components/AppShell';
import { SummaryCard } from '../components/SummaryCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MapPicker } from '../components/MapPicker';
import { MapViewer } from '../components/MapViewer';
import { AddToCalendarButton } from '../components/AddToCalendarButton';
import { createStudentLessonEvent } from '../utils/calendar';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch, getErrorMessage } from '../apiClient';
import { PageLoading } from '../components/LoadingSpinner';
import { SchoolSelectorBanner } from '../components/SchoolSelectorBanner';
import { formatDateTime, formatDate, formatTime, todayDateString } from '../utils/timezone';

type StudentProfile = {
  id: number;
  fullName: string;
  licenceStatus: string;
  licenceNumber?: string | null;
  licenceImageUrl?: string | null;
  licenceExpiryDate?: string | null;
  licenceProvinceOrState?: string | null;
  licenceRejectionNote?: string | null;
  allowedHours?: number | null;
  maxLessonsPerDay?: number | null;
};

type Address = {
  id: number;
  label: string;
  line1: string;
  city: string;
  provinceOrState: string;
  isDefaultPickup?: boolean;
  isDefaultDropoff?: boolean;
};

type Booking = { id: number; studentId: number; driverId: number; startTime: string; status: string };
type DriverProfile = { id: number; fullName: string; active: boolean };

type SuggestedSlot = { startTime: string; driverId: number };

export default function StudentPage() {
  const { token, user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  const [overrideSchoolId, setOverrideSchoolId] = useState<number | null>(null);
  const schoolId = useMemo(() => overrideSchoolId ?? user?.schoolId, [overrideSchoolId, user?.schoolId]);

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pastBookings, setPastBookings] = useState<Booking[]>([]);
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);
  const [usedHours, setUsedHours] = useState<number>(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [status, setStatus] = useState<string>('Loading student data...');
  const [addressForm, setAddressForm] = useState({
    label: '',
    line1: '',
    city: '',
    provinceOrState: '',
    latitude: '',
    longitude: '',
    isDefaultPickup: true,
    isDefaultDropoff: true,
  });
  const [slotQuery, setSlotQuery] = useState({ driverId: '', pickupId: '', dropoffId: '', date: '' });
  const [bookingForm, setBookingForm] = useState({ driverId: '', pickupId: '', dropoffId: '', startTime: '' });
  const [cancelReason, setCancelReason] = useState<Record<number, string>>({});
  const [reschedule, setReschedule] = useState<Record<number, string>>({});
  const [actionMessage, setActionMessage] = useState('');
  const [licenceForm, setLicenceForm] = useState({
    licenceNumber: '',
    licenceProvinceOrState: '',
    licenceExpiryDate: '',
  });
  const [uploadingLicence, setUploadingLicence] = useState(false);
  const [confirmCancelBooking, setConfirmCancelBooking] = useState<number | null>(null);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);

  async function fetchSlots(driverId: number, pickupId: number, dropoffId: number, date: string) {
    if (!token || !schoolId) return;
    try {
      const slots = await apiFetch<string[]>(
        `/schools/${schoolId}/drivers/${driverId}/available-slots?date=${date}&pickupAddressId=${pickupId}&dropoffAddressId=${dropoffId}`,
        token,
      ).catch(() => []);
      setSuggestedSlots(slots.map((slot) => ({ startTime: slot, driverId })));
    } catch (error) {
      setSuggestedSlots([]);
    }
  }

  async function loadStudentContext() {
    if (!token || !schoolId) { setInitialLoading(false); return; }
    try {
      setStatus('Loading student profile and addresses...');
      const studentResults = await apiFetch<StudentProfile[]>(`/schools/${schoolId}/students`, token);
      const activeStudent = studentResults.find((entry) => entry) ?? null;
      setStudent(activeStudent);

      const bookingFeed = await apiFetch<Booking[]>(`/schools/${schoolId}/bookings?status=upcoming`, token).catch(() => []);
      setBookings(activeStudent ? bookingFeed.filter((booking) => booking.studentId === activeStudent.id) : bookingFeed);

      // Load past bookings
      const pastFeed = await apiFetch<Booking[]>(`/schools/${schoolId}/bookings?status=past`, token).catch(() => []);
      setPastBookings(activeStudent ? pastFeed.filter((booking) => booking.studentId === activeStudent.id) : pastFeed);

      // Load usage statistics (remaining hours)
      if (activeStudent) {
        const usage = await apiFetch<{ usedHours: number; allowedHours: number | null; todayBookings: number; maxLessonsPerDay: number | null }>(
          `/schools/${schoolId}/students/${activeStudent.id}/usage`,
          token,
        ).catch(() => ({ usedHours: 0, allowedHours: null, todayBookings: 0, maxLessonsPerDay: null }));
        setUsedHours(usage.usedHours);
      }

      if (!activeStudent) {
        setStatus('No student profile found.');
        setInitialLoading(false);
        return;
      }

      // Populate licence form with existing data
      setLicenceForm({
        licenceNumber: activeStudent.licenceNumber ?? '',
        licenceProvinceOrState: activeStudent.licenceProvinceOrState ?? '',
        licenceExpiryDate: activeStudent.licenceExpiryDate?.split('T')[0] ?? '',
      });

      const addressResults = await apiFetch<Address[]>(
        `/schools/${schoolId}/students/${activeStudent.id}/addresses`,
        token,
      ).catch(() => []);
      setAddresses(addressResults);

      const driverResults = await apiFetch<DriverProfile[]>(`/schools/${schoolId}/drivers`, token).catch(() => []);
      setDrivers(driverResults);
      const driver = driverResults.find((entry) => entry.active) ?? driverResults[0];
      const pickup = addressResults.find((address) => address.isDefaultPickup) ?? (addressResults.length > 0 ? addressResults[0] : undefined);
      const dropoff = addressResults.find((address) => address.isDefaultDropoff) ?? (addressResults.length > 1 ? addressResults[1] : pickup);
      const dateParam = todayDateString();

      setSlotQuery({
        driverId: driver?.id ? String(driver.id) : '',
        pickupId: pickup?.id ? String(pickup.id) : '',
        dropoffId: dropoff?.id ? String(dropoff.id) : '',
        date: dateParam,
      });

      setBookingForm({
        driverId: driver?.id ? String(driver.id) : '',
        pickupId: pickup?.id ? String(pickup.id) : '',
        dropoffId: dropoff?.id ? String(dropoff.id) : '',
        startTime: '',
      });

      if (driver && pickup && dropoff) {
        await fetchSlots(driver.id, pickup.id, dropoff.id, dateParam);
        setStatus('');
      } else {
        setStatus('');
      }
      setInitialLoading(false);
    } catch (error) {
      setStatus('Unable to load student portal data. Check your token and backend availability.');
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    loadStudentContext();
  }, [schoolId, token]);

  async function addAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId || !student) return;
    if (!addressForm.line1.trim()) {
      toast.error('Street address (line1) is required. Please select a location on the map or enter it manually.');
      return;
    }
    const toastId = toast.loading('Saving address...');
    try {
      await apiFetch(`/schools/${schoolId}/students/${student.id}/addresses`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addressForm,
          latitude: addressForm.latitude ? Number(addressForm.latitude) : null,
          longitude: addressForm.longitude ? Number(addressForm.longitude) : null,
        }),
      });
      setAddressForm({
        label: '',
        line1: '',
        city: '',
        provinceOrState: '',
        latitude: '',
        longitude: '',
        isDefaultPickup: false,
        isDefaultDropoff: false,
      });
      await loadStudentContext();
      toast.success('Address saved!', { id: toastId });
    } catch (error) {
      toast.error('Unable to save address.', { id: toastId });
    }
  }

  async function createBooking(startTime: string) {
    if (!token || !schoolId || !student) return;
    const driverId = Number(bookingForm.driverId || suggestedSlots[0]?.driverId);
    const pickupId = Number(bookingForm.pickupId);
    const dropoffId = Number(bookingForm.dropoffId);
    if (!driverId || !pickupId || !dropoffId) {
      toast.error('Please select a driver, pickup address, and dropoff address before booking.');
      return;
    }
    const toastId = toast.loading('Creating booking...');
    try {
      await apiFetch(`/schools/${schoolId}/bookings`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          studentId: student.id,
          pickupAddressId: pickupId,
          dropoffAddressId: dropoffId,
          startTime,
        }),
      });
      await loadStudentContext();
      setSuggestedSlots([]);
      toast.success('Booking created!', { id: toastId });
    } catch (error) {
      toast.error(getErrorMessage(error), { id: toastId });
      // Re-fetch slots so stale/booked times are removed
      if (driverId && pickupId && dropoffId && slotQuery.date) {
        fetchSlots(driverId, pickupId, dropoffId, slotQuery.date);
      }
    }
  }

  async function rescheduleBooking(bookingId: number) {
    if (!token || !schoolId || !reschedule[bookingId]) return;
    const toastId = toast.loading('Rescheduling...');
    try {
      await apiFetch(`/schools/${schoolId}/bookings/${bookingId}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: new Date(reschedule[bookingId]).toISOString() }),
      });
      setReschedule((prev) => ({ ...prev, [bookingId]: '' }));
      await loadStudentContext();
      toast.success('Booking rescheduled!', { id: toastId });
    } catch (error) {
      toast.error(getErrorMessage(error), { id: toastId });
    }
  }

  async function cancelBooking(bookingId: number) {
    if (!token || !schoolId) return;
    const toastId = toast.loading('Cancelling...');
    try {
      await apiFetch(`/schools/${schoolId}/bookings/${bookingId}/cancel`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode: cancelReason[bookingId] || undefined }),
      });
      setCancelReason((prev) => ({ ...prev, [bookingId]: '' }));
      await loadStudentContext();
      toast.success('Booking cancelled.', { id: toastId });
    } catch (error) {
      toast.error(getErrorMessage(error), { id: toastId });
    }
  }

  async function updateLicence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !schoolId || !student) return;
    const toastId = toast.loading('Updating licence...');
    try {
      await apiFetch(`/schools/${schoolId}/students/${student.id}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenceNumber: licenceForm.licenceNumber || undefined,
          licenceProvinceOrState: licenceForm.licenceProvinceOrState || undefined,
          licenceExpiryDate: licenceForm.licenceExpiryDate || undefined,
        }),
      });
      await loadStudentContext();
      toast.success('Licence info saved! It is now pending admin review.', { id: toastId, duration: 5000 });
    } catch (error) {
      toast.error(getErrorMessage(error), { id: toastId });
    }
  }

  async function handleLicenceImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token || !schoolId || !student) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploadingLicence(true);
    const toastId = toast.loading('Uploading licence image...');

    try {
      // Convert file to base64 for simple storage (in production, use Cloud Storage)
      const reader = new FileReader();
      reader.onerror = () => {
        toast.error('Failed to read licence image file.', { id: toastId });
        setUploadingLicence(false);
      };
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          await apiFetch(`/schools/${schoolId}/students/${student.id}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenceImageUrl: base64 }),
          });
          await loadStudentContext();
          toast.success('Licence image uploaded! It is now pending admin review.', { id: toastId, duration: 5000 });
        } catch (err) {
          toast.error('Failed to save licence image.', { id: toastId });
        }
        setUploadingLicence(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Unable to upload licence image.', { id: toastId });
      setUploadingLicence(false);
    }
  }

  const policyHint = student
    ? `Signed in as ${student.fullName}`
    : status;

  // Superadmin without a school selected — show selector only
  if (isSuperadmin && !schoolId) {
    return (
      <Protected allowedRoles={['student', 'school_admin', 'superadmin']}>
        <AppShell>
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-slate-900">Student portal</h1>
            <SchoolSelectorBanner selectedSchoolId={overrideSchoolId} onSelect={setOverrideSchoolId} />
          </div>
        </AppShell>
      </Protected>
    );
  }

  if (!student && initialLoading) {
    return (
      <Protected allowedRoles={['student', 'school_admin', 'superadmin']}>
        <AppShell><PageLoading message="Loading student portal..." /></AppShell>
      </Protected>
    );
  }

  return (
    <Protected allowedRoles={['student', 'school_admin', 'superadmin']}>
      <AppShell>
        <div className="space-y-4">
          <SchoolSelectorBanner selectedSchoolId={overrideSchoolId} onSelect={setOverrideSchoolId} />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Student portal</h1>
            <p className="text-sm text-slate-800">
              Upload licence details, manage pickup/dropoff addresses, and browse policy-checked slots.
            </p>
            <p className="text-xs text-slate-800">{policyHint}</p>
            {actionMessage ? <p className="text-[11px] text-slate-800">{actionMessage}</p> : null}
          </div>

          {/* Booking Limits Display */}
          {student && (student.allowedHours !== null || student.maxLessonsPerDay !== null) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">📊 Your Booking Limits</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {student.allowedHours !== null && (
                  <div>
                    <p className="text-slate-900">Hours Used</p>
                    <p className="text-xl font-bold text-blue-700">
                      {usedHours.toFixed(1)} / {student.allowedHours}
                    </p>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (usedHours / (student.allowedHours || 1)) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-800 mt-1">
                      {Math.max(0, (student.allowedHours ?? 0) - usedHours).toFixed(1)} hours remaining
                    </p>
                  </div>
                )}
                {student.maxLessonsPerDay !== null && (
                  <div>
                    <p className="text-slate-800">Daily Limit</p>
                    <p className="text-xl font-bold text-blue-700">
                      {student.maxLessonsPerDay} lesson{student.maxLessonsPerDay !== 1 ? 's' : ''}/day
                    </p>
                    <p className="text-xs text-slate-800 mt-1">
                      Maximum bookings per day
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard
              title="Addresses"
              description="Your pickup and dropoff locations."
              footer={addresses.length > 0 ? `${addresses.length} address(es) saved` : ''}
            >
              <ul className="space-y-1 text-sm text-slate-800">
                {addresses.map((address) => (
                  <li key={address.id} className="border rounded p-2 bg-slate-50">
                    <p className="font-medium text-slate-800">{address.label}</p>
                    <p className="text-xs text-slate-800">{address.line1}</p>
                    <p className="text-xs text-slate-800">
                      {address.city}, {address.provinceOrState}
                    </p>
                    <p className="text-[11px] text-slate-800">
                      Pickup: {address.isDefaultPickup ? 'default' : 'no'} · Dropoff: {address.isDefaultDropoff ? 'default' : 'no'}
                    </p>
                  </li>
                ))}
                {addresses.length === 0 && !status ? (
                  <li className="text-xs text-slate-800">No addresses on file yet.</li>
                ) : null}
              </ul>
              <form className="mt-3 space-y-3 text-sm" onSubmit={addAddress}>
                <div>
                  <label className="block text-xs font-medium text-slate-800 mb-1">Address Label *</label>
                  <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="e.g. Home, Work, School"
                    value={addressForm.label}
                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                    required
                  />
                </div>

                {/* Map Location Picker - now with autofill */}
                <div>
                  <label className="block text-xs font-medium text-slate-800 mb-1">Search & Select Location *</label>
                  <MapPicker
                    latitude={addressForm.latitude ? parseFloat(addressForm.latitude) : null}
                    longitude={addressForm.longitude ? parseFloat(addressForm.longitude) : null}
                    onLocationSelect={(lat, lng, address) => {
                      setAddressForm({
                        ...addressForm,
                        latitude: lat.toString(),
                        longitude: lng.toString(),
                        line1: address?.line1 || addressForm.line1,
                        city: address?.city || addressForm.city,
                        provinceOrState: address?.provinceOrState || addressForm.provinceOrState,
                      });
                    }}
                  />
                </div>

                {/* Display auto-filled address or allow manual entry */}
                {(addressForm.line1 || addressForm.city) && (
                  <div className="bg-slate-50 border rounded-lg p-3 text-slate-800">
                    <p className="text-xs font-medium text-slate-800 mb-1">📍 Selected Address:</p>
                    <p className="font-medium text-slate-800">{addressForm.line1 || 'Street not detected'}</p>
                    <p className="text-sm">{addressForm.city}{addressForm.city && addressForm.provinceOrState ? ', ' : ''}{addressForm.provinceOrState}</p>
                  </div>
                )}

                {/* Manual entry fallback (collapsed by default, expandable if needed) */}
                {!addressForm.line1 && !addressForm.latitude && (
                  <div className="space-y-2">
                    <input
                      className="border rounded px-3 py-2 w-full text-slate-800"
                      placeholder="Street address"
                      value={addressForm.line1}
                      onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <input
                        className="border rounded px-3 py-2 w-full text-slate-800"
                        placeholder="City"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      />
                      <input
                        className="border rounded px-3 py-2 w-full text-slate-800"
                        placeholder="Province"
                        value={addressForm.provinceOrState}
                        onChange={(e) => setAddressForm({ ...addressForm, provinceOrState: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-4 text-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addressForm.isDefaultPickup}
                      onChange={(e) => setAddressForm({ ...addressForm, isDefaultPickup: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Default pickup</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addressForm.isDefaultDropoff}
                      onChange={(e) => setAddressForm({ ...addressForm, isDefaultDropoff: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Default dropoff</span>
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm font-medium hover:bg-slate-800"
                >
                  Save address
                </button>
              </form>
            </SummaryCard>
            <SummaryCard
              title="Licence & documents"
              description="Upload your licence to enable booking. Status updates after admin review."
              footer={student?.licenceStatus === 'approved'
                ? <span className="text-green-700 font-medium">✓ Verified — You can book lessons</span>
                : <span className="text-amber-700 font-semibold">⏳ Pending admin verification</span>}
            >
              <div className="space-y-3">
                {/* Status Display */}
                <div className={`p-3 rounded-lg ${student?.licenceStatus === 'approved'
                  ? 'bg-green-50 border border-green-200'
                  : student?.licenceStatus === 'rejected'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${student?.licenceStatus === 'approved' ? 'text-green-600'
                      : student?.licenceStatus === 'rejected' ? 'text-red-600'
                        : 'text-yellow-600'
                      }`}>
                      {student?.licenceStatus === 'approved' ? '✓' : student?.licenceStatus === 'rejected' ? '✗' : '⏳'}
                    </span>
                    <div>
                      <p className={`font-semibold text-sm ${student?.licenceStatus === 'approved' ? 'text-green-800' : student?.licenceStatus === 'rejected' ? 'text-red-800' : 'text-yellow-800'}`}>
                        {student?.licenceStatus === 'approved'
                          ? 'Approved'
                          : student?.licenceStatus === 'rejected'
                            ? 'Rejected'
                            : 'Pending Review'}
                      </p>
                      <p className="text-xs text-slate-700">
                        {student?.licenceStatus === 'approved'
                          ? 'Your licence is verified. You can book lessons.'
                          : student?.licenceStatus === 'rejected'
                            ? (student?.licenceRejectionNote
                              ? `Reason: ${student.licenceRejectionNote}`
                              : 'Please upload a valid licence image.')
                            : 'Waiting for admin review.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Current Licence Image */}
                {student?.licenceImageUrl && (
                  <div className="border rounded-lg p-2 bg-slate-50">
                    <p className="text-xs text-slate-800 mb-2">Current licence image:</p>
                    <img
                      src={student.licenceImageUrl}
                      alt="Licence"
                      className="max-w-full h-24 object-contain rounded border"
                    />
                  </div>
                )}

                {/* Upload Image */}
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Upload Licence Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLicenceImageUpload}
                    disabled={uploadingLicence}
                    className="block w-full text-sm text-slate-800 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 disabled:opacity-50"
                  />
                  {uploadingLicence && <p className="text-xs text-slate-800 mt-1">Uploading...</p>}
                </div>

                {/* Licence Details Form */}
                <form onSubmit={updateLicence} className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-800 mb-1">Licence Number *</label>
                    <input
                      type="text"
                      className="w-full border rounded px-3 py-2 text-sm text-slate-900"
                      placeholder="ABCDE123456789"
                      value={licenceForm.licenceNumber}
                      onChange={(e) => setLicenceForm({ ...licenceForm, licenceNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-800 mb-1">Province/State</label>
                      <input
                        type="text"
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="e.g. NS"
                        value={licenceForm.licenceProvinceOrState}
                        onChange={(e) => setLicenceForm({ ...licenceForm, licenceProvinceOrState: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-800 mb-1">Expiry Date</label>
                      <input
                        type="date"
                        className="w-full border rounded px-3 py-2 text-sm"
                        value={licenceForm.licenceExpiryDate}
                        onChange={(e) => setLicenceForm({ ...licenceForm, licenceExpiryDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm hover:bg-slate-800"
                  >
                    Save Licence Info
                  </button>
                </form>
              </div>
            </SummaryCard>
            <SummaryCard
              title="Book a lesson"
              description="Find available lesson times."
              footer={status || ''}
            >
              {student?.licenceStatus !== 'approved' ? (
                <div className="text-center py-6">
                  {!student?.licenceImageUrl && !student?.licenceNumber ? (
                    <div className="space-y-3">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-2xl">&#128196;</span>
                      </div>
                      <p className="text-slate-900 font-semibold">Licence required</p>
                      <p className="text-sm text-slate-600">
                        Please upload your licence in the Licence & documents section to start booking lessons.
                      </p>
                    </div>
                  ) : student?.licenceStatus === 'rejected' ? (
                    <div className="space-y-3">
                      <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-2xl text-red-500">&#10007;</span>
                      </div>
                      <p className="text-red-700 font-semibold">Licence rejected</p>
                      <p className="text-sm text-slate-600">
                        {student?.licenceRejectionNote
                          ? `Reason: ${student.licenceRejectionNote}`
                          : 'Please upload a valid licence image and try again.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-2xl">&#9203;</span>
                      </div>
                      <p className="text-amber-700 font-semibold">Licence waiting for approval</p>
                      <p className="text-sm text-slate-600">
                        Your licence has been submitted and is being reviewed. You&apos;ll be able to book lessons once an admin approves it.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    className="border rounded px-2 py-1 text-slate-900"
                    value={slotQuery.driverId}
                    onChange={(e) => setSlotQuery({ ...slotQuery, driverId: e.target.value })}
                  >
                    <option value="">Select driver</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.fullName}
                      </option>
                    ))}
                  </select>
                  <input
                    className="border rounded px-2 py-1 text-slate-900"
                    type="date"
                    value={slotQuery.date}
                    onChange={(e) => setSlotQuery({ ...slotQuery, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <select
                    className="border rounded px-2 py-1 text-slate-900"
                    value={slotQuery.pickupId}
                    onChange={(e) => setSlotQuery({ ...slotQuery, pickupId: e.target.value })}
                  >
                    <option value="">Pickup address</option>
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="border rounded px-2 py-1 text-slate-900"
                    value={slotQuery.dropoffId}
                    onChange={(e) => setSlotQuery({ ...slotQuery, dropoffId: e.target.value })}
                  >
                    <option value="">Dropoff address</option>
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="w-full bg-blue-600 text-white font-medium rounded px-3 py-2 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500"
                  type="button"
                  onClick={() =>
                    slotQuery.driverId &&
                    slotQuery.pickupId &&
                    slotQuery.dropoffId &&
                    slotQuery.date &&
                    fetchSlots(
                      Number(slotQuery.driverId),
                      Number(slotQuery.pickupId),
                      Number(slotQuery.dropoffId),
                      slotQuery.date,
                    )
                  }
                  disabled={!slotQuery.driverId || !slotQuery.pickupId || !slotQuery.dropoffId || !slotQuery.date}
                >
                  Find Available Slots
                </button>
                <ul className="space-y-2">
                  {suggestedSlots.map((slot) => (
                    <li key={`${slot.driverId}-${slot.startTime}`} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                      <div>
                        <span className="text-sm font-medium text-slate-800">{formatDateTime(slot.startTime)}</span>
                        <span className="text-xs text-slate-800 ml-2">with {drivers.find(d => d.id === slot.driverId)?.fullName ?? 'Instructor'}</span>
                      </div>
                      <button
                        className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 text-sm font-medium"
                        type="button"
                        onClick={() => createBooking(slot.startTime)}
                      >
                        Book This Slot
                      </button>
                    </li>
                  ))}
                  {suggestedSlots.length === 0 && !status ? (
                    <li className="text-sm text-slate-700 text-center py-4">
                      No availability for the selected day.
                    </li>
                  ) : null}
                </ul>
              </div>
              )}
            </SummaryCard>
          </div>
          <SummaryCard
            title="Upcoming bookings"
            description="View and manage your scheduled lessons."
            footer={status || ''}
          >
            <ul className="space-y-2 text-sm text-slate-800">
              {bookings.map((booking) => (
                <li key={booking.id} className="border rounded p-3 bg-slate-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-slate-800">{formatDateTime(booking.startTime)}</p>
                      <p className="text-xs text-slate-800">Status: {booking.status}</p>
                    </div>
                    <p className="text-xs text-slate-800">
                      Driver: {drivers.find((driver) => driver.id === booking.driverId)?.fullName ?? 'Driver'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs items-center">
                    <AddToCalendarButton
                      event={createStudentLessonEvent(
                        drivers.find((d) => d.id === booking.driverId)?.fullName ?? 'Instructor',
                        new Date(booking.startTime),
                        new Date(new Date(booking.startTime).getTime() + 90 * 60 * 1000), // 90 min lesson
                      )}
                    />
                    <input
                      className="border rounded px-2 py-1 text-slate-900"
                      type="datetime-local"
                      value={reschedule[booking.id] ?? ''}
                      onChange={(e) => setReschedule((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                      placeholder="New start time"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    <button
                      className="px-3 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 min-h-[32px]"
                      type="button"
                      disabled={!reschedule[booking.id]}
                      onClick={() => rescheduleBooking(booking.id)}
                    >
                      Reschedule
                    </button>
                    <input
                      className="border rounded px-2 py-1"
                      placeholder="Cancel reason"
                      value={cancelReason[booking.id] ?? ''}
                      onChange={(e) => setCancelReason((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                    />
                    <button
                      className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-500 min-h-[32px]"
                      type="button"
                      onClick={() => setConfirmCancelBooking(booking.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
              {bookings.length === 0 && !status ? (
                <li className="text-xs text-slate-800">No bookings scheduled yet.</li>
              ) : null}
            </ul>
          </SummaryCard>
          <SummaryCard
            title="Past Lessons"
            description="Your completed and cancelled lessons."
            footer={`${pastBookings.length} past lesson(s)`}
          >
            <ul className="space-y-2 text-sm text-slate-800 max-h-64 overflow-y-auto">
              {pastBookings.map((booking) => (
                <li key={booking.id} className="border rounded p-3 bg-slate-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-slate-800">{formatDate(booking.startTime)}</p>
                      <p className="text-xs text-slate-800">
                        {formatTime(booking.startTime)}
                        {' with '}
                        {drivers.find((d) => d.id === booking.driverId)?.fullName ?? 'Unknown'}
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
              {pastBookings.length === 0 ? (
                <li className="text-xs text-slate-800 text-center py-4">No past lessons yet.</li>
              ) : null}
            </ul>
          </SummaryCard>
        </div>
      </AppShell>

      {/* Cancel Booking Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmCancelBooking !== null}
        title="Cancel Booking"
        message="Are you sure you want to cancel this lesson? This action cannot be undone."
        confirmLabel="Yes, Cancel Lesson"
        cancelLabel="Keep Booking"
        variant="danger"
        loading={isCancellingBooking}
        onConfirm={async () => {
          if (!confirmCancelBooking) return;
          setIsCancellingBooking(true);
          await cancelBooking(confirmCancelBooking);
          setIsCancellingBooking(false);
          setConfirmCancelBooking(null);
        }}
        onCancel={() => setConfirmCancelBooking(null)}
      />
    </Protected>
  );
}

