import { getPool } from '../db';
import { SchoolSettings, SchoolSettingsRow, mapSchoolSettings } from '../models';

export async function getSchoolSettings(drivingSchoolId: number): Promise<SchoolSettings | null> {
  const result = await getPool().query<SchoolSettingsRow>(
    `SELECT * FROM school_settings WHERE driving_school_id = $1`,
    [drivingSchoolId],
  );

  if (result.rowCount === 0) return null;
  return mapSchoolSettings(result.rows[0]);
}

export async function upsertSchoolSettings(
  drivingSchoolId: number,
  settings: Partial<Omit<SchoolSettings, 'id' | 'drivingSchoolId' | 'createdAt' | 'updatedAt'>>,
): Promise<SchoolSettings> {
  // Load existing settings first to merge, preventing null-wipe on partial updates
  const existing = await getSchoolSettings(drivingSchoolId);

  const merged = {
    minBookingLeadTimeHours: settings.minBookingLeadTimeHours !== undefined ? settings.minBookingLeadTimeHours : (existing?.minBookingLeadTimeHours ?? null),
    cancellationCutoffHours: settings.cancellationCutoffHours !== undefined ? settings.cancellationCutoffHours : (existing?.cancellationCutoffHours ?? null),
    defaultLessonDurationMinutes: settings.defaultLessonDurationMinutes !== undefined ? settings.defaultLessonDurationMinutes : (existing?.defaultLessonDurationMinutes ?? null),
    defaultBufferMinutesBetweenLessons: settings.defaultBufferMinutesBetweenLessons !== undefined ? settings.defaultBufferMinutesBetweenLessons : (existing?.defaultBufferMinutesBetweenLessons ?? null),
    defaultServiceRadiusKm: settings.defaultServiceRadiusKm !== undefined ? settings.defaultServiceRadiusKm : (existing?.defaultServiceRadiusKm ?? null),
    defaultMaxSegmentTravelTimeMin: settings.defaultMaxSegmentTravelTimeMin !== undefined ? settings.defaultMaxSegmentTravelTimeMin : (existing?.defaultMaxSegmentTravelTimeMin ?? null),
    defaultMaxSegmentTravelDistanceKm: settings.defaultMaxSegmentTravelDistanceKm !== undefined ? settings.defaultMaxSegmentTravelDistanceKm : (existing?.defaultMaxSegmentTravelDistanceKm ?? null),
    defaultDailyMaxTravelTimeMin: settings.defaultDailyMaxTravelTimeMin !== undefined ? settings.defaultDailyMaxTravelTimeMin : (existing?.defaultDailyMaxTravelTimeMin ?? null),
    defaultDailyMaxTravelDistanceKm: settings.defaultDailyMaxTravelDistanceKm !== undefined ? settings.defaultDailyMaxTravelDistanceKm : (existing?.defaultDailyMaxTravelDistanceKm ?? null),
    dailyBookingCapPerDriver: settings.dailyBookingCapPerDriver !== undefined ? settings.dailyBookingCapPerDriver : (existing?.dailyBookingCapPerDriver ?? null),
    allowStudentToPickDriver: settings.allowStudentToPickDriver !== undefined ? settings.allowStudentToPickDriver : (existing?.allowStudentToPickDriver ?? true),
    allowDriverSelfAvailabilityEdit: settings.allowDriverSelfAvailabilityEdit !== undefined ? settings.allowDriverSelfAvailabilityEdit : (existing?.allowDriverSelfAvailabilityEdit ?? true),
  };

  const result = await getPool().query<SchoolSettingsRow>(
    `INSERT INTO school_settings (
      driving_school_id,
      min_booking_lead_time_hours,
      cancellation_cutoff_hours,
      default_lesson_duration_minutes,
      default_buffer_minutes_between_lessons,
      default_service_radius_km,
      default_max_segment_travel_time_min,
      default_max_segment_travel_distance_km,
      default_daily_max_travel_time_min,
      default_daily_max_travel_distance_km,
      daily_booking_cap_per_driver,
      allow_student_to_pick_driver,
      allow_driver_self_availability_edit
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
    ) ON CONFLICT (driving_school_id) DO UPDATE SET
      min_booking_lead_time_hours = EXCLUDED.min_booking_lead_time_hours,
      cancellation_cutoff_hours = EXCLUDED.cancellation_cutoff_hours,
      default_lesson_duration_minutes = EXCLUDED.default_lesson_duration_minutes,
      default_buffer_minutes_between_lessons = EXCLUDED.default_buffer_minutes_between_lessons,
      default_service_radius_km = EXCLUDED.default_service_radius_km,
      default_max_segment_travel_time_min = EXCLUDED.default_max_segment_travel_time_min,
      default_max_segment_travel_distance_km = EXCLUDED.default_max_segment_travel_distance_km,
      default_daily_max_travel_time_min = EXCLUDED.default_daily_max_travel_time_min,
      default_daily_max_travel_distance_km = EXCLUDED.default_daily_max_travel_distance_km,
      daily_booking_cap_per_driver = EXCLUDED.daily_booking_cap_per_driver,
      allow_student_to_pick_driver = EXCLUDED.allow_student_to_pick_driver,
      allow_driver_self_availability_edit = EXCLUDED.allow_driver_self_availability_edit,
      updated_at = NOW()
    RETURNING *`,
    [
      drivingSchoolId,
      merged.minBookingLeadTimeHours,
      merged.cancellationCutoffHours,
      merged.defaultLessonDurationMinutes,
      merged.defaultBufferMinutesBetweenLessons,
      merged.defaultServiceRadiusKm,
      merged.defaultMaxSegmentTravelTimeMin,
      merged.defaultMaxSegmentTravelDistanceKm,
      merged.defaultDailyMaxTravelTimeMin,
      merged.defaultDailyMaxTravelDistanceKm,
      merged.dailyBookingCapPerDriver,
      merged.allowStudentToPickDriver,
      merged.allowDriverSelfAvailabilityEdit,
    ],
  );

  return mapSchoolSettings(result.rows[0]);
}
