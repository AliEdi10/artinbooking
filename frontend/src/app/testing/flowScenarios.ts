/* eslint-disable @typescript-eslint/no-explicit-any */
type ApiFetch = (path: string, token: string, options?: RequestInit) => Promise<any>;

export async function loadAdminData(apiFetch: ApiFetch, schoolId: number, token: string) {
  const [settings, drivers, students, bookings] = await Promise.all([
    apiFetch(`/schools/${schoolId}/settings`, token),
    apiFetch(`/schools/${schoolId}/drivers`, token),
    apiFetch(`/schools/${schoolId}/students`, token),
    apiFetch(`/schools/${schoolId}/bookings`, token),
  ]);

  return {
    settings,
    drivers,
    students,
    bookings,
    selectedBookingId: bookings[0]?.id ?? null,
  };
}

export async function rescheduleBookingFlow(
  apiFetch: ApiFetch,
  schoolId: number,
  token: string,
  bookingId: number,
  start: string,
  driverId?: string,
) {
  const patch: Record<string, string | number> = {};
  if (start) patch.startTime = new Date(start).toISOString();
  if (driverId) patch.driverId = Number(driverId);

  await apiFetch(`/schools/${schoolId}/bookings/${bookingId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  return patch;
}

export async function cancelBookingFlow(
  apiFetch: ApiFetch,
  schoolId: number,
  token: string,
  bookingId: number,
  reason?: string,
) {
  await apiFetch(`/schools/${schoolId}/bookings/${bookingId}/cancel`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reasonCode: reason || undefined }),
  });
}

export async function addDriverFlow(
  apiFetch: ApiFetch,
  schoolId: number,
  token: string,
  payload: { userId: number; fullName: string; phone?: string },
) {
  await apiFetch(`/schools/${schoolId}/drivers`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function loadBookingWorkspace(apiFetch: ApiFetch, schoolId: number, token: string) {
  const [drivers, students, bookings] = await Promise.all([
    apiFetch(`/schools/${schoolId}/drivers`, token),
    apiFetch(`/schools/${schoolId}/students`, token),
    apiFetch(`/schools/${schoolId}/bookings`, token),
  ]);

  let status = '';
  let slots: { startTime: string; driverId: number }[] = [];

  const driver = drivers.find((entry: any) => entry.active) ?? drivers[0];
  const student = students[0];

  if (driver && student) {
    const addresses = await apiFetch(`/schools/${schoolId}/students/${student.id}/addresses`, token).catch(() => []);
    const pickup = addresses.find((entry: any) => entry.isDefaultPickup) ?? addresses[0];
    const dropoff = addresses.find((entry: any) => entry.isDefaultDropoff) ?? addresses[1] ?? pickup;

    if (pickup && dropoff) {
      const dateParam = new Date().toISOString().slice(0, 10);
      const slotResults = await apiFetch(
        `/schools/${schoolId}/drivers/${driver.id}/available-slots?date=${dateParam}&pickupAddressId=${pickup.id}&dropoffAddressId=${dropoff.id}`,
        token,
      ).catch(() => []);
      slots = slotResults.map((slot: string) => ({ startTime: slot, driverId: driver.id }));
    } else {
      status = 'Add pickup and dropoff addresses to browse slots.';
    }
  }

  return {
    drivers,
    students,
    bookings,
    slots,
    status,
  };
}

export function simulateLocalLoginFlow(
  token: string,
  setToken: (value: string) => void,
  replace: (path: string) => void,
) {
  if (!token.trim()) return false;
  setToken(token.trim());
  replace('/');
  return true;
}
