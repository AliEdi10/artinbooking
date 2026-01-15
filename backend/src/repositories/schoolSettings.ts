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
      settings.minBookingLeadTimeHours ?? null,
      settings.cancellationCutoffHours ?? null,
      settings.defaultLessonDurationMinutes ?? null,
      settings.defaultBufferMinutesBetweenLessons ?? null,
      settings.defaultServiceRadiusKm ?? null,
      settings.defaultMaxSegmentTravelTimeMin ?? null,
      settings.defaultMaxSegmentTravelDistanceKm ?? null,
      settings.defaultDailyMaxTravelTimeMin ?? null,
      settings.defaultDailyMaxTravelDistanceKm ?? null,
      settings.dailyBookingCapPerDriver ?? null,
      settings.allowStudentToPickDriver ?? true,
      settings.allowDriverSelfAvailabilityEdit ?? true,
    ],
  );

  return mapSchoolSettings(result.rows[0]);
}
