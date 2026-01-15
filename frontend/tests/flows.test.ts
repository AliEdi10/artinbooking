import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedRole, shouldRedirectToLogin } from '../src/app/auth/accessUtils';
import { parseToken } from '../src/app/auth/tokenUtils';
import {
  addDriverFlow,
  cancelBookingFlow,
  loadAdminData,
  loadBookingWorkspace,
  rescheduleBookingFlow,
  simulateLocalLoginFlow,
} from '../src/app/testing/flowScenarios';

function createMockApi() {
  const calls: Array<{ path: string; token: string; options?: RequestInit | undefined }> = [];
  const responses = new Map<string, any>();

  const apiFetch = async (path: string, token: string, options?: RequestInit) => {
    calls.push({ path, token, options });
    const direct = responses.get(path);
    if (direct !== undefined) return structuredClone(direct);

    const withoutQuery = path.split('?')[0];
    const fallback = responses.get(withoutQuery);
    if (fallback !== undefined) return structuredClone(fallback);

    return [];
  };

  return { apiFetch, calls, responses };
}

test('parseToken normalizes role and school data', () => {
  const payload = { email: 'user@example.com', role: 'School_Admin', driving_school_id: 12 };
  const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

  const parsed = parseToken(token);

  assert.equal(parsed?.email, 'user@example.com');
  assert.equal(parsed?.role, 'school_admin');
  assert.equal(parsed?.schoolId, 12);
});

test('protected access helpers capture login and role rules', () => {
  assert.equal(shouldRedirectToLogin(false, null), true);
  assert.equal(shouldRedirectToLogin(true, null), false);
  assert.equal(isAllowedRole(undefined, undefined), true);
  assert.equal(isAllowedRole(['admin'], undefined), false);
  assert.equal(isAllowedRole(['admin'], 'admin'), true);
  assert.equal(isAllowedRole(['driver'], 'student'), false);
});

test('admin data loaders support roster updates and booking edits', async () => {
  const { apiFetch, calls, responses } = createMockApi();
  const schoolId = 42;

  responses.set(`/schools/${schoolId}/settings`, { id: schoolId, minBookingLeadTimeHours: 2 });
  responses.set(`/schools/${schoolId}/drivers`, [
    { id: 1, fullName: 'Driver One', active: true },
    { id: 2, fullName: 'Driver Two', active: false },
  ]);
  responses.set(`/schools/${schoolId}/students`, [
    { id: 10, fullName: 'Student One', licenceStatus: 'verified', active: true },
  ]);
  responses.set(`/schools/${schoolId}/bookings`, [
    { id: 100, studentId: 10, driverId: 1, status: 'scheduled', startTime: '2024-01-01T10:00:00Z' },
  ]);

  const initial = await loadAdminData(apiFetch, schoolId, 'token');

  assert.equal(initial.settings.minBookingLeadTimeHours, 2);
  assert.equal(initial.drivers.length, 2);
  assert.equal(initial.students.length, 1);
  assert.equal(initial.bookings[0].id, 100);

  await addDriverFlow(apiFetch, schoolId, 'token', { userId: 99, fullName: 'New Driver' });
  await rescheduleBookingFlow(apiFetch, schoolId, 'token', 100, '2024-02-01T09:30');
  await cancelBookingFlow(apiFetch, schoolId, 'token', 100, 'no-show');

  const rescheduleCall = calls.find((call) => call.path.endsWith('/bookings/100') && call.options?.method === 'PATCH');
  assert.ok(rescheduleCall);
  assert.match(rescheduleCall!.options?.body as string, /startTime/);

  const cancelCall = calls.find((call) => call.path.endsWith('/bookings/100/cancel'));
  assert.ok(cancelCall);

  const addDriverCall = calls.find((call) => call.path.endsWith('/drivers') && call.options?.method === 'POST');
  assert.ok(addDriverCall);
});

test('booking workspace aggregates availability search output', async () => {
  const { apiFetch, responses } = createMockApi();
  const schoolId = 7;

  responses.set(`/schools/${schoolId}/drivers`, [
    { id: 1, fullName: 'Active Driver', active: true },
  ]);
  responses.set(`/schools/${schoolId}/students`, [
    { id: 200, fullName: 'Student', active: true },
  ]);
  responses.set(`/schools/${schoolId}/bookings`, []);
  responses.set(`/schools/${schoolId}/students/200/addresses`, [
    { id: 300, isDefaultPickup: true },
    { id: 301, isDefaultDropoff: true },
  ]);
  responses.set(`/schools/${schoolId}/drivers/1/available-slots`, ['2025-01-01T10:00:00Z']);

  const result = await loadBookingWorkspace(apiFetch, schoolId, 'token');

  assert.equal(result.status, '');
  assert.equal(result.slots.length, 1);
  assert.equal(result.slots[0].driverId, 1);
});

test('local login simulation stores token and redirects', () => {
  let savedToken = '';
  let redirectedTo: string | null = null;

  const setToken = (value: string) => {
    savedToken = value;
  };

  const replace = (path: string) => {
    redirectedTo = path;
  };

  const success = simulateLocalLoginFlow('  sample-token  ', setToken, replace);

  assert.equal(success, true);
  assert.equal(savedToken, 'sample-token');
  assert.equal(redirectedTo, '/');
});

