import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

type Endpoint = {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  path: string;
  body?: Record<string, unknown>;
};

const endpoints: Endpoint[] = [
  { method: 'post', path: '/auth/login', body: {} },
  { method: 'post', path: '/auth/forgot-password', body: {} },
  { method: 'post', path: '/auth/reset-password', body: {} },
  { method: 'get', path: '/invitations/validate?token=example' },
  { method: 'post', path: '/invitations/accept', body: {} },

  { method: 'get', path: '/schools' },
  { method: 'post', path: '/schools', body: {} },
  { method: 'patch', path: '/schools/1', body: {} },
  { method: 'patch', path: '/schools/1/status', body: {} },

  { method: 'get', path: '/users?role=SCHOOL_ADMIN' },
  { method: 'get', path: '/system/status' },

  { method: 'get', path: '/schools/1/settings' },
  { method: 'put', path: '/schools/1/settings', body: {} },
  { method: 'patch', path: '/schools/1/settings', body: {} },

  { method: 'get', path: '/schools/1/drivers' },
  { method: 'post', path: '/schools/1/drivers', body: {} },
  { method: 'patch', path: '/schools/1/drivers/1', body: {} },
  { method: 'get', path: '/schools/1/drivers/1/availability' },
  { method: 'post', path: '/schools/1/drivers/1/availability', body: {} },
  { method: 'delete', path: '/schools/1/drivers/1/availability/1' },
  { method: 'get', path: '/schools/1/drivers/1/available-slots?date=2026-01-01&pickupAddressId=1&dropoffAddressId=2' },
  { method: 'get', path: '/schools/1/drivers/holidays' },
  { method: 'get', path: '/schools/1/drivers/1/earnings' },

  { method: 'get', path: '/schools/1/students' },
  { method: 'patch', path: '/schools/1/students/1', body: {} },
  { method: 'get', path: '/schools/1/students/1/usage' },
  { method: 'get', path: '/schools/1/students/1/addresses' },
  { method: 'post', path: '/schools/1/students/1/addresses', body: {} },
  { method: 'get', path: '/schools/1/addresses/batch?studentIds=1,2' },

  { method: 'get', path: '/schools/1/bookings' },
  { method: 'post', path: '/schools/1/bookings', body: {} },
  { method: 'patch', path: '/schools/1/bookings/1', body: {} },
  { method: 'post', path: '/schools/1/bookings/1/cancel', body: {} },
  { method: 'post', path: '/schools/1/bookings/1/complete', body: {} },

  { method: 'get', path: '/schools/1/invitations' },
  { method: 'post', path: '/schools/1/invitations', body: {} },
  { method: 'get', path: '/schools/1/invitations/pending' },
  { method: 'post', path: '/schools/1/invitations/1/resend', body: {} },
  { method: 'delete', path: '/schools/1/invitations/1' },

  { method: 'get', path: '/schools/1/analytics/summary' },
  { method: 'get', path: '/schools/1/analytics/bookings-by-week' },
  { method: 'get', path: '/schools/1/analytics/signups?days=30' },
  { method: 'get', path: '/schools/1/analytics/driver-utilization' },
  { method: 'get', path: '/schools/1/analytics/active-inactive' },
  { method: 'get', path: '/schools/1/audit-logs?limit=20' },
];

describe('frontend/backend endpoint contract', () => {
  it.each(endpoints)('$method $path is routed (not 404)', async ({ method, path, body }) => {
    const app = createApp();
    let req = request(app)[method](path);
    if (body) {
      req = req.send(body);
    }

    const response = await req;
    expect(response.status, `${method.toUpperCase()} ${path} returned 404 (route missing)`).not.toBe(404);
  });
});
