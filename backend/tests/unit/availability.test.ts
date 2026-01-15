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
  it('returns 15-minute grid slots for an empty day', async () => {
    const driver = driverProfile();
    const date = new Date('2024-05-01T00:00:00Z');
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

    const firstSlot = new Date('2024-05-01T09:00:00Z').getTime();
    const lastSlot = new Date('2024-05-01T16:00:00Z').getTime();
    expect(slots[0].getTime()).toBe(firstSlot);
    expect(slots[slots.length - 1].getTime()).toBe(lastSlot);
    // 9am to 4pm inclusive on 15 minute grid is 29 slots
    expect(slots.length).toBe(29);
  });

  it('skips times that overlap existing bookings', async () => {
    const driver = driverProfile({ workDayEnd: '12:00' });
    const date = new Date('2024-05-02T00:00:00Z');
    const bookings = [
      bookingWithLocations(
        '2024-05-02T10:00:00Z',
        '2024-05-02T11:00:00Z',
        baseLocation,
        baseLocation,
      ),
    ];

    const slots = await computeAvailableSlots(
      { date, driverProfile: driver, bookings, pickupLocation: baseLocation, dropoffLocation: baseLocation },
      travelZero,
    );

    expect(slots.find((slot) => slot.toISOString() === '2024-05-02T10:00:00.000Z')).toBeUndefined();
    expect(slots.some((slot) => slot.toISOString() === '2024-05-02T11:00:00.000Z')).toBe(true);
  });

  it('filters out slots that violate travel constraints', async () => {
    const driver = driverProfile({ maxSegmentTravelTimeMin: 10 });
    const date = new Date('2024-05-03T00:00:00Z');
    const slowTravel: TravelCalculator = {
      distanceBetween: () => 5,
      travel: () => ({ timeMinutes: 30, distanceKm: 5 }),
    };

    const slots = await computeAvailableSlots(
      { date, driverProfile: driver, bookings: [], pickupLocation: baseLocation, dropoffLocation: baseLocation },
      slowTravel,
    );

    expect(slots.length).toBe(0);
  });
});
