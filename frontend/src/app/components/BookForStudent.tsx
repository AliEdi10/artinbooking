'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch, getErrorMessage } from '../apiClient';
import { todayDateString } from '../utils/timezone';
import toast from 'react-hot-toast';

type Student = { id: number; fullName: string; licenceStatus?: string; active?: boolean };
type Driver = { id: number; fullName: string; active?: boolean };
type Address = {
  id: number;
  label: string | null;
  line1: string;
  city: string | null;
  provinceOrState?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefaultPickup: boolean;
  isDefaultDropoff: boolean;
};
type SlotOption = { startTime: string; driverId: number };

function buildMapsUrl(addr: Address): string {
  if (addr.latitude != null && addr.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${addr.latitude},${addr.longitude}`;
  }
  const parts = [addr.line1, addr.city, addr.provinceOrState, addr.postalCode].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

interface BookForStudentProps {
  schoolId: number;
  token: string;
  students: Student[];
  drivers: Driver[];
  /** If set, locks the driver to this ID (for driver page) */
  fixedDriverId?: number;
  onBooked: () => void;
}

export function BookForStudent({ schoolId, token, students, drivers, fixedDriverId, onBooked }: BookForStudentProps) {
  const [studentId, setStudentId] = useState<number | ''>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [driverId, setDriverId] = useState<number | ''>(fixedDriverId ?? '');
  const [date, setDate] = useState(todayDateString());
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [pickupId, setPickupId] = useState<number | ''>('');
  const [dropoffId, setDropoffId] = useState<number | ''>('');
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  const approvedStudents = students.filter(s => s.active !== false && s.licenceStatus === 'approved');
  const activeDrivers = drivers.filter(d => d.active !== false);

  const trimmedSearch = studentSearch.trim().toLowerCase();
  const filteredStudents = trimmedSearch
    ? approvedStudents.filter(s => s.fullName.toLowerCase().includes(trimmedSearch))
    : approvedStudents;

  // Load addresses when student changes
  useEffect(() => {
    if (!studentId) { setAddresses([]); setPickupId(''); setDropoffId(''); return; }
    apiFetch<Address[]>(`/schools/${schoolId}/students/${studentId}/addresses`, token)
      .then(addrs => {
        setAddresses(addrs);
        const pickup = addrs.find(a => a.isDefaultPickup) ?? addrs[0];
        const dropoff = addrs.find(a => a.isDefaultDropoff) ?? (addrs.length > 1 ? addrs[1] : pickup);
        setPickupId(pickup?.id ?? '');
        setDropoffId(dropoff?.id ?? '');
      })
      .catch(() => setAddresses([]));
  }, [studentId, schoolId, token]);

  // Fetch available slots when all fields are filled
  useEffect(() => {
    setSlots([]);
    setSelectedSlot('');
    if (!studentId || !driverId || !pickupId || !dropoffId || !date) return;
    setLoadingSlots(true);
    apiFetch<string[]>(
      `/schools/${schoolId}/drivers/${driverId}/available-slots?date=${date}&pickupAddressId=${pickupId}&dropoffAddressId=${dropoffId}`,
      token,
    )
      .then(result => {
        const mapped = result.map(s => ({ startTime: s, driverId: Number(driverId) }));
        setSlots(mapped);
        if (mapped.length > 0) setSelectedSlot(mapped[0].startTime);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [studentId, driverId, pickupId, dropoffId, date, schoolId, token]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !driverId || !selectedSlot || !pickupId || !dropoffId) return;
    setBooking(true);
    try {
      await apiFetch(`/schools/${schoolId}/bookings`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          driverId,
          startTime: selectedSlot,
          pickupAddressId: pickupId,
          dropoffAddressId: dropoffId,
        }),
      });
      toast.success('Booking created successfully!');
      setSelectedSlot('');
      setSlots([]);
      onBooked();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBooking(false);
    }
  }

  const formatSlotTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { timeZone: 'America/Halifax', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <form onSubmit={handleBook} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Student</label>
          <input
            type="text"
            placeholder="Search student by name..."
            className="border rounded px-2 py-1.5 w-full text-sm text-slate-900 mb-1"
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
          />
          <select
            className="border rounded px-2 py-1.5 w-full text-sm text-slate-900"
            value={studentId}
            onChange={e => setStudentId(Number(e.target.value) || '')}
            required
            size={trimmedSearch && filteredStudents.length > 0 && filteredStudents.length <= 6 ? filteredStudents.length + 1 : undefined}
          >
            <option value="">
              {filteredStudents.length === 0 ? 'No matching students' : 'Select student...'}
            </option>
            {filteredStudents.map(s => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        </div>
        {!fixedDriverId && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Instructor</label>
            <select
              className="border rounded px-2 py-1.5 w-full text-sm text-slate-900"
              value={driverId}
              onChange={e => setDriverId(Number(e.target.value) || '')}
              required
            >
              <option value="">Select instructor...</option>
              {activeDrivers.map(d => (
                <option key={d.id} value={d.id}>{d.fullName}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {studentId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Pickup Address</label>
            <select
              className="border rounded px-2 py-1.5 w-full text-sm text-slate-900"
              value={pickupId}
              onChange={e => setPickupId(Number(e.target.value) || '')}
              required
            >
              <option value="">Select pickup...</option>
              {addresses.map(a => (
                <option key={a.id} value={a.id}>{a.label || a.line1}, {a.city}</option>
              ))}
            </select>
            {pickupId && addresses.find(a => a.id === pickupId) && (
              <a
                href={buildMapsUrl(addresses.find(a => a.id === pickupId)!)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                🧭 Open in Maps
              </a>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Drop-off Address</label>
            <select
              className="border rounded px-2 py-1.5 w-full text-sm text-slate-900"
              value={dropoffId}
              onChange={e => setDropoffId(Number(e.target.value) || '')}
              required
            >
              <option value="">Select drop-off...</option>
              {addresses.map(a => (
                <option key={a.id} value={a.id}>{a.label || a.line1}, {a.city}</option>
              ))}
            </select>
            {dropoffId && addresses.find(a => a.id === dropoffId) && (
              <a
                href={buildMapsUrl(addresses.find(a => a.id === dropoffId)!)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                🧭 Open in Maps
              </a>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
        <input
          type="date"
          className="border rounded px-2 py-1.5 w-full text-sm text-slate-900"
          value={date}
          onChange={e => setDate(e.target.value)}
          min={todayDateString()}
          required
        />
      </div>

      {loadingSlots && <p className="text-xs text-slate-500">Loading available slots...</p>}

      {!loadingSlots && studentId && driverId && pickupId && dropoffId && date && slots.length === 0 && (
        <p className="text-xs text-red-600">No available slots for this date. Try another date or instructor.</p>
      )}

      {slots.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Available Slots</label>
          <div className="flex flex-wrap gap-1.5">
            {slots.map(slot => (
              <button
                key={slot.startTime}
                type="button"
                className={`px-3 py-1.5 text-xs rounded border ${
                  selectedSlot === slot.startTime
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                }`}
                onClick={() => setSelectedSlot(slot.startTime)}
              >
                {formatSlotTime(slot.startTime)}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={booking || !selectedSlot}
        className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {booking ? 'Booking...' : 'Create Booking'}
      </button>
    </form>
  );
}
