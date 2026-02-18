import { Booking, DriverAvailability, DriverProfile, SchoolSettings } from '../models';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface BookingWithLocations extends Booking {
  pickupLocation: Location;
  dropoffLocation: Location;
}

export interface TravelCalculator {
  distanceBetween: (from: Location, to: Location) => number;
  travel: (from: Location, to: Location, departure: Date) => Promise<{
    timeMinutes: number;
    distanceKm: number;
  }>;
}

interface Gap {
  gapStartTime: Date;
  gapEndTime: Date;
  startLocation: Location;
  endLocation: Location;
  baselineTravelTime: number;
  baselineTravelDistance: number;
}

const GRID_MINUTES = 15;

function roundUpToGrid(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % GRID_MINUTES;
  if (remainder !== 0) {
    rounded.setMinutes(minutes + (GRID_MINUTES - remainder), 0, 0);
  } else {
    rounded.setSeconds(0, 0);
  }
  return rounded;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function parseTimeForDate(date: Date, timeStr?: string | null): Date {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  if (!timeStr) return base;
  const [hours, minutes] = timeStr.split(':').map((part) => Number(part));
  base.setHours(hours || 0, minutes || 0, 0, 0);
  return base;
}

function coerceNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const numeric = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : undefined;
}

async function buildEvents(
  date: Date,
  driverProfile: DriverProfile,
  bookings: BookingWithLocations[],
  travel: TravelCalculator,
  openWindows: { start: Date; end: Date }[],
) {
  const gaps: Gap[] = [];
  let baselineTotals = { time: 0, distance: 0 };

  // eslint-disable-next-line no-restricted-syntax
  for (const { window, bookings: windowBookings } of openWindows
    .map((window) => ({
      window,
      bookings: bookings
        .filter(
          (booking) =>
            booking.startTime.toISOString().slice(0, 10) === date.toISOString().slice(0, 10) &&
            booking.startTime >= window.start &&
            booking.startTime < window.end,
        )
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    }))) {
    const events = [
      {
        startTime: window.start,
        endTime: window.start,
        startLocation: driverProfile.serviceCenterLocation as Location,
        endLocation: driverProfile.serviceCenterLocation as Location,
      },
      ...windowBookings.map((booking) => ({
        startTime: booking.startTime,
        endTime: booking.endTime,
        startLocation: booking.pickupLocation,
        endLocation: booking.dropoffLocation,
      })),
      {
        startTime: window.end,
        endTime: window.end,
        startLocation: driverProfile.serviceCenterLocation as Location,
        endLocation: driverProfile.serviceCenterLocation as Location,
      },
    ];

    for (let i = 0; i < events.length - 1; i += 1) {
      const current = events[i];
      const next = events[i + 1];
      const travelMetrics = await travel.travel(
        current.endLocation,
        next.startLocation,
        current.endTime,
      );
      gaps.push({
        gapStartTime: current.endTime,
        gapEndTime: next.startTime,
        startLocation: current.endLocation,
        endLocation: next.startLocation,
        baselineTravelDistance: travelMetrics.distanceKm,
        baselineTravelTime: travelMetrics.timeMinutes,
      });
      baselineTotals = {
        time: baselineTotals.time + travelMetrics.timeMinutes,
        distance: baselineTotals.distance + travelMetrics.distanceKm,
      };
    }
  }

  return { gaps, baselineTotals };
}

function mergeIntervals(intervals: { start: Date; end: Date }[]): { start: Date; end: Date }[] {
  const sorted = intervals
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return sorted.reduce<{ start: Date; end: Date }[]>((acc, interval) => {
    const last = acc[acc.length - 1];
    if (!last || interval.start.getTime() > last.end.getTime()) {
      acc.push(interval);
    } else if (interval.end.getTime() > last.end.getTime()) {
      last.end = interval.end;
    }
    return acc;
  }, []);
}

function subtractInterval(
  intervals: { start: Date; end: Date }[],
  removal: { start: Date; end: Date },
): { start: Date; end: Date }[] {
  const result: { start: Date; end: Date }[] = [];
  intervals.forEach((interval) => {
    const startsAfter = removal.start.getTime() >= interval.end.getTime();
    const endsBefore = removal.end.getTime() <= interval.start.getTime();
    if (startsAfter || endsBefore) {
      result.push(interval);
      return;
    }

    if (removal.start.getTime() > interval.start.getTime()) {
      result.push({ start: interval.start, end: removal.start });
    }

    if (removal.end.getTime() < interval.end.getTime()) {
      result.push({ start: removal.end, end: interval.end });
    }
  });

  return result;
}

function deriveOpenWindows(
  date: Date,
  driverProfile: DriverProfile,
  availabilities: DriverAvailability[] | undefined,
): { start: Date; end: Date }[] {
  const dateStr = date.toISOString().slice(0, 10);
  const sameDay = availabilities?.filter((entry) => entry.date.toISOString().slice(0, 10) === dateStr) ?? [];

  const workingWindows = sameDay
    .filter((entry) => entry.type === 'working_hours')
    .map((entry) => ({ start: parseTimeForDate(date, entry.startTime), end: parseTimeForDate(date, entry.endTime) }));

  const baseWindows =
    workingWindows.length > 0
      ? workingWindows
      : driverProfile.workDayStart && driverProfile.workDayEnd
        ? [
          {
            start: parseTimeForDate(date, driverProfile.workDayStart ?? undefined),
            end: parseTimeForDate(date, driverProfile.workDayEnd ?? undefined),
          },
        ]
        : [];

  const withOpenOverrides = mergeIntervals([
    ...baseWindows,
    ...sameDay
      .filter((entry) => entry.type === 'override_open')
      .map((entry) => ({ start: parseTimeForDate(date, entry.startTime), end: parseTimeForDate(date, entry.endTime) })),
  ]);

  const closedIntervals = sameDay
    .filter((entry) => entry.type === 'override_closed')
    .map((entry) => ({ start: parseTimeForDate(date, entry.startTime), end: parseTimeForDate(date, entry.endTime) }));

  const afterClosures = closedIntervals.reduce(
    (acc, closed) => subtractInterval(acc, closed),
    withOpenOverrides,
  );

  return mergeIntervals(afterClosures);
}

export interface AvailabilityRequest {
  date: Date;
  driverProfile: DriverProfile;
  bookings: BookingWithLocations[];
  pickupLocation: Location;
  dropoffLocation: Location;
  schoolSettings?: SchoolSettings | null;
  availabilities?: DriverAvailability[];
}

export async function computeAvailableSlots(
  request: AvailabilityRequest,
  travel: TravelCalculator,
): Promise<Date[]> {
  const { date, driverProfile, bookings, pickupLocation, dropoffLocation, schoolSettings, availabilities } = request;
  const bufferMinutes =
    driverProfile.bufferMinutesBetweenLessons ?? schoolSettings?.defaultBufferMinutesBetweenLessons ?? 0;
  const lessonDuration = driverProfile.lessonDurationMinutes ?? schoolSettings?.defaultLessonDurationMinutes ?? 60;
  const serviceRadius =
    coerceNumber(driverProfile.serviceRadiusKm) ?? coerceNumber(schoolSettings?.defaultServiceRadiusKm) ?? Infinity;
  const maxSegmentTime =
    driverProfile.maxSegmentTravelTimeMin ?? schoolSettings?.defaultMaxSegmentTravelTimeMin ?? Infinity;
  const maxSegmentDistance =
    coerceNumber(driverProfile.maxSegmentTravelDistanceKm) ??
    coerceNumber(schoolSettings?.defaultMaxSegmentTravelDistanceKm) ??
    Infinity;
  const dailyMaxTravelTime =
    driverProfile.dailyMaxTravelTimeMin ?? schoolSettings?.defaultDailyMaxTravelTimeMin ?? undefined;
  const dailyMaxTravelDistance =
    coerceNumber(driverProfile.dailyMaxTravelDistanceKm) ??
    coerceNumber(schoolSettings?.defaultDailyMaxTravelDistanceKm) ??
    undefined;

  if (!driverProfile.serviceCenterLocation) return [];

  const openWindows = deriveOpenWindows(date, driverProfile, availabilities);
  if (openWindows.length === 0) return [];

  const { gaps, baselineTotals } = await buildEvents(date, driverProfile, bookings, travel, openWindows);

  const feasibleSlots: Date[] = [];
  const radiusToPickup = travel.distanceBetween(driverProfile.serviceCenterLocation as Location, pickupLocation);
  const radiusToDropoff = travel.distanceBetween(driverProfile.serviceCenterLocation as Location, dropoffLocation);
  if (radiusToPickup > serviceRadius || radiusToDropoff > serviceRadius) {
    return [];
  }

  // Detect window boundaries: driver is expected to be at the location by
  // window start and doesn't need to return to service center before window end.
  // Travel time only applies between bookings, not at day boundaries.
  const windowStartTimes = new Set(openWindows.map((w) => w.start.getTime()));
  const windowEndTimes = new Set(openWindows.map((w) => w.end.getTime()));

  // eslint-disable-next-line no-restricted-syntax
  for (const gap of gaps) {
    if (gap.gapEndTime <= gap.gapStartTime) continue;
    const isFirstInWindow = windowStartTimes.has(gap.gapStartTime.getTime());
    const isLastInWindow = windowEndTimes.has(gap.gapEndTime.getTime());
    let candidate = roundUpToGrid(addMinutes(gap.gapStartTime, bufferMinutes));

    while (candidate < gap.gapEndTime) {
      const candidateEnd = addMinutes(candidate, lessonDuration);
      if (candidateEnd.getTime() + bufferMinutes * 60 * 1000 > gap.gapEndTime.getTime()) {
        break;
      }

      // Calculate travel into and out of the candidate slot; both legs are required so avoid
      // removing either call when resolving merges.
      // eslint-disable-next-line no-await-in-loop
      const travelPrev = await travel.travel(gap.startLocation, pickupLocation, candidate);
      // eslint-disable-next-line no-await-in-loop
      const travelNext = await travel.travel(dropoffLocation, gap.endLocation, candidateEnd);

      // At day boundaries, skip travel time — the driver handles commute on their own time.
      // Between bookings, travel time is enforced so slots don't overlap.
      const effectivePrevTime = isFirstInWindow ? 0 : travelPrev.timeMinutes;
      const effectiveNextTime = isLastInWindow ? 0 : travelNext.timeMinutes;

      const startsAfterGap =
        candidate.getTime() >=
        addMinutes(gap.gapStartTime, bufferMinutes + effectivePrevTime).getTime();
      const endsBeforeNext =
        addMinutes(candidateEnd, bufferMinutes + effectiveNextTime).getTime() <= gap.gapEndTime.getTime();

      const segmentLimitsSatisfied =
        (isFirstInWindow || (travelPrev.timeMinutes <= maxSegmentTime && travelPrev.distanceKm <= maxSegmentDistance)) &&
        (isLastInWindow || (travelNext.timeMinutes <= maxSegmentTime && travelNext.distanceKm <= maxSegmentDistance));

      const adjustedTotals = {
        time: baselineTotals.time - gap.baselineTravelTime + effectivePrevTime + effectiveNextTime,
        distance:
          baselineTotals.distance - gap.baselineTravelDistance +
          (isFirstInWindow ? 0 : travelPrev.distanceKm) + (isLastInWindow ? 0 : travelNext.distanceKm),
      };

      const dailyCapsSatisfied =
        (dailyMaxTravelTime === undefined || adjustedTotals.time <= dailyMaxTravelTime) &&
        (dailyMaxTravelDistance === undefined || adjustedTotals.distance <= dailyMaxTravelDistance);

      if (startsAfterGap && endsBeforeNext && segmentLimitsSatisfied && dailyCapsSatisfied) {
        feasibleSlots.push(candidate);
      }

      candidate = addMinutes(candidate, GRID_MINUTES);
    }
  }

  const unique = Array.from(new Set(feasibleSlots.map((dt) => dt.getTime())))
    .sort((a, b) => a - b)
    .map((ts) => new Date(ts));

  return unique;
}

export function createSimpleTravelCalculator(avgSpeedKph = 40): TravelCalculator {
  const haversineKm = (from: Location, to: Location) => {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(to.latitude - from.latitude);
    const dLon = toRad(to.longitude - from.longitude);
    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.latitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return {
    distanceBetween: (from, to) => haversineKm(from, to),
    travel: async (from, to, _departure) => {
      const distanceKm = haversineKm(from, to);
      const timeMinutes = (distanceKm / avgSpeedKph) * 60;
      return { distanceKm, timeMinutes };
    },
  };
}
