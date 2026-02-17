'use client';

import { useEffect, useMemo, useState } from 'react';
import { Protected } from '../auth/Protected';
import { AppShell } from '../components/AppShell';
import { SummaryCard } from '../components/SummaryCard';
import { apiFetch } from '../apiClient';
import { useAuth } from '../auth/AuthProvider';

type AvailableSlot = { startTime: string; driverId: number };
type Booking = { id: number; status: string; startTime: string; driverId: number; studentId: number };
type DriverProfile = { id: number; fullName: string; active: boolean };
type StudentProfile = { id: number; fullName: string };
type Address = { id: number; isDefaultPickup?: boolean; isDefaultDropoff?: boolean };

export default function BookingsPage() {
  const { token, user } = useAuth();
  const schoolId = useMemo(() => user?.schoolId, [user?.schoolId]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [status, setStatus] = useState<string>('Loading booking data...');

  useEffect(() => {
    if (!token || !schoolId) return;

    async function loadData() {
      if (!token) return; // Type guard for TypeScript
      try {
        setStatus('Loading roster and bookings...');
        const [driverResults, studentResults, bookingResults] = await Promise.all([
          apiFetch<DriverProfile[]>(`/schools/${schoolId}/drivers`, token!),
          apiFetch<StudentProfile[]>(`/schools/${schoolId}/students`, token!),
          apiFetch<Booking[]>(`/schools/${schoolId}/bookings`, token!),
        ]);

        setDrivers(driverResults);
        setStudents(studentResults);
        setBookings(bookingResults);

        const driver = driverResults.find((entry) => entry.active) ?? driverResults[0];
        const student = studentResults[0];

        if (driver && student) {
          const addresses = await apiFetch<Address[]>(
            `/schools/${schoolId}/students/${student.id}/addresses`,
            token!,
          ).catch(() => []);
          const pickup = addresses.find((entry) => entry.isDefaultPickup) ?? (addresses.length > 0 ? addresses[0] : undefined);
          const dropoff = addresses.find((entry) => entry.isDefaultDropoff) ?? (addresses.length > 1 ? addresses[1] : pickup);

          if (pickup && dropoff) {
            const dateParam = new Date().toISOString().slice(0, 10);
            const slotResults = await apiFetch<string[]>(
              `/schools/${schoolId}/drivers/${driver.id}/available-slots?date=${dateParam}&pickupAddressId=${pickup.id}&dropoffAddressId=${dropoff.id}`,
              token!,
            ).catch(() => []);
            setSlots(slotResults.map((slot) => ({ startTime: slot, driverId: driver.id })));
          } else {
            setStatus('Add pickup and dropoff addresses to browse slots.');
            return;
          }
        }

        setStatus('');
      } catch (error) {
        setStatus('Unable to reach backend; check your token and API service.');
      }
    }

    loadData();
  }, [schoolId, token]);

  return (
    <Protected>
      <AppShell>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Booking & availability</h1>
              <p className="text-sm text-slate-800">Manage bookings and view available slots.</p>
            </div>
            {status && <p className="text-xs text-slate-800">{status}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SummaryCard
              title="Available slots"
              description="Travel-aware availability for the selected driver and addresses."
              footer=""
            >
              <ul className="space-y-1 text-sm text-slate-800">
                {slots.map((slot) => {
                  const driverName = drivers.find((driver) => driver.id === slot.driverId)?.fullName ?? 'Driver';
                  return (
                    <li key={`${slot.startTime}-${slot.driverId}`} className="border rounded p-2 bg-slate-50">
                      <p className="font-medium">{new Date(slot.startTime).toLocaleString()}</p>
                      <p className="text-xs text-slate-800">Driver: {driverName}</p>
                    </li>
                  );
                })}
                {slots.length === 0 && !status ? (
                  <li className="text-xs text-slate-800">No available slots returned for the provided addresses.</li>
                ) : null}
              </ul>
            </SummaryCard>
            <SummaryCard
              title="Bookings"
              description="Create, cancel, and review bookings. This view shows current commitments."
              footer=""
            >
              <ul className="space-y-1 text-sm text-slate-800">
                {bookings.map((booking) => {
                  const driverName = drivers.find((driver) => driver.id === booking.driverId)?.fullName ?? 'Driver';
                  const studentName = students.find((student) => student.id === booking.studentId)?.fullName ?? 'Student';
                  return (
                    <li key={booking.id} className="border rounded p-2 bg-slate-50">
                      <p className="font-medium">{new Date(booking.startTime).toLocaleString()}</p>
                      <p className="text-xs text-slate-800">{studentName} with {driverName}</p>
                      <p className="text-xs text-slate-800">Status: {booking.status}</p>
                    </li>
                  );
                })}
                {bookings.length === 0 && !status ? (
                  <li className="text-xs text-slate-800">No bookings found for this school.</li>
                ) : null}
              </ul>
            </SummaryCard>
          </div>
        </div>
      </AppShell>
    </Protected>
  );
}
