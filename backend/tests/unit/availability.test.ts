import { describe, expect, it } from 'vitest';
import {
  BookingWithLocations,
  computeAvailableSlots,
  Location,
  TravelCalculator,
} from '../../src/services/availability';
import { DriverProfile } from '../../src/models';

const baseLocation: Location = { latitude: 44.64, longitude: -63.57 };
const travelZero: TravelCalculator = {
  distanceBetween: () => 0,
  travel: () => ({ timeMinutes: 0, distanceKm: 0 }),
};

function driverProfile(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    id: 1,
    userId: 1,
    drivingSchoolId: 1,
    fullName: 'Test Driver',
    phone: null,
    serviceCenterLocation: baseLocation,
    workDayStart: '09:00',
    workDayEnd: '17:00',
    lessonDurationMinutes: 60,
    bufferMinutesBetweenLessons: 0,
    serviceRadiusKm: '15',
    maxSegmentTravelTimeMin: 120,
    maxSegmentTravelDistanceKm: '50',
    dailyMaxTravelTimeMin: null,
    dailyMaxTravelDistanceKm: null,
    notes: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function bookingWithLocations(
  start: string,
  end: string,
  pickup: Location,
  dropoff: Location,
): BookingWithLocations {
  return {
    id: 1,
    drivingSchoolId: 1,
    studentId: 1,
    driverId: 1,
    pickupAddressId: 1,
    dropoffAddressId: 1,
    startTime: new Date(start),
    endTime: new Date(end),
    status: 'scheduled',
    cancellationReasonCode: null,
    priceAmount: null,
    notes: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    pickupLocation: pickup,
    dropoffLocation: dropoff,
  };
}

describe('computeAvailableSlots', () => {
  // All times use local (Halifax) timezone — no Z suffix — to match the
  // production TZ=America/Halifax setting configured in backend/src/index.ts.

  it('returns 15-minute grid slots for an empty day', async () => {
    const driver = driverProfile();
    const date = new Date('2024-05-01T00:00:00');
    const slots = await computeAvailableSlots(
      {
        date,
        driverProfile: driver,
        bookings: [],
        pickupLocation: baseLocation,
        dropoffLocation: baseLocation,
      },
      travelZero,
    );

    const firstSlot = new Date('2024-05-01T09:00:00').getTime();
    const lastSlot = new Date('2024-05-01T16:00:00').getTime();
    expect(slots[0].getTime()).toBe(firstSlot);
    expect(slots[slots.length - 1].getTime()).toBe(lastSlot);
    // 9am to 4pm inclusive on 15 minute grid is 29 slots
    expect(slots.length).toBe(29);
  });

  it('skips times that overlap existing bookings', async () => {
    const driver = driverProfile({ workDayEnd: '12:00' });
    const date = new Date('2024-05-02T00:00:00');
    const bookings = [
      bookingWithLocations(
        '2024-05-02T10:00:00',
        '2024-05-02T11:00:00',
        baseLocation,
        baseLocation,
      ),
    ];

    const slots = await computeAvailableSlots(
      { date, driverProfile: driver, bookings, pickupLocation: baseLocation, dropoffLocation: baseLocation },
      travelZero,
    );

    const occupiedTime = new Date('2024-05-02T10:00:00').toISOString();
    const freeTime = new Date('2024-05-02T11:00:00').toISOString();
    expect(slots.find((slot) => slot.toISOString() === occupiedTime)).toBeUndefined();
    expect(slots.some((slot) => slot.toISOString() === freeTime)).toBe(true);
  });

  it('enforces compact scheduling — only adjacent slots when bookings exist', async () => {
    // Driver works 9am-5pm, 60-min lessons, no buffer, zero travel.
    // Existing booking: 12:00-1:00pm.
    // Without compact scheduling: 9:00-11:00 and 1:00-4:00 would all be available (25 slots).
    // With compact scheduling: only 11:00 (adjacent before) and 1:00 (adjacent after).
    const driver = driverProfile();
    const date = new Date('2024-05-04T00:00:00');
    const bookings = [
      bookingWithLocations('2024-05-04T12:00:00', '2024-05-04T13:00:00', baseLocation, baseLocation),
    ];

    const slots = await computeAvailableSlots(
      { date, driverProfile: driver, bookings, pickupLocation: baseLocation, dropoffLocation: baseLocation },
      travelZero,
    );

    // Only two slots: 11:00 (right before booking) and 13:00 (right after booking)
    expect(slots.length).toBe(2);
    expect(slots[0].getTime()).toBe(new Date('2024-05-04T11:00:00').getTime());
    expect(slots[1].getTime()).toBe(new Date('2024-05-04T13:00:00').getTime());
  });

  it('filters out slots that violate travel constraints', async () => {
    const driver = driverProfile({ maxSegmentTravelTimeMin: 10 });
    const date = new Date('2024-05-03T00:00:00');
    // Place bookings at day boundaries so the candidate gap is between bookings
    // (not at day start/end where travel time is intentionally skipped).
    const bookings = [
      bookingWithLocations(
        '2024-05-03T09:00:00',
        '2024-05-03T10:00:00',
        baseLocation,
        baseLocation,
      ),
      bookingWithLocations(
        '2024-05-03T16:00:00',
        '2024-05-03T17:00:00',
        baseLocation,
        baseLocation,
      ),
    ];
    const slowTravel: TravelCalculator = {
      distanceBetween: () => 5,
      travel: () => ({ timeMinutes: 30, distanceKm: 5 }),
    };

    const slots = await computeAvailableSlots(
      { date, driverProfile: driver, bookings, pickupLocation: baseLocation, dropoffLocation: baseLocation },
      slowTravel,
    );

    expect(slots.length).toBe(0);
  });
});
