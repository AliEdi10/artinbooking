export type DrivingSchoolStatus = 'active' | 'suspended' | 'deleted';
export type UserRole = 'SUPERADMIN' | 'SCHOOL_ADMIN' | 'DRIVER' | 'STUDENT';
export type UserStatus = 'active' | 'disabled';
export type LicenceStatus = 'pending_review' | 'approved' | 'rejected';
export type AvailabilityType = 'working_hours' | 'override_open' | 'override_closed';
export type BookingStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled_by_student'
  | 'cancelled_by_driver'
  | 'cancelled_by_school';

export interface DrivingSchoolRow {
  id: number;
  name: string;
  legal_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province_or_state: string | null;
  postal_code: string | null;
  country: string | null;
  status: DrivingSchoolStatus;
  created_at: Date;
  updated_at: Date;
}

export interface DrivingSchool {
  id: number;
  name: string;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  provinceOrState: string | null;
  postalCode: string | null;
  country: string | null;
  status: DrivingSchoolStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRow {
  id: number;
  driving_school_id: number | null;
  email: string;
  identity_provider: string;
  identity_subject: string | null;
  password_hash: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: number;
  drivingSchoolId: number | null;
  email: string;
  identityProvider: string;
  identitySubject: string | null;
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverProfileRow {
  id: number;
  user_id: number;
  driving_school_id: number;
  full_name: string;
  phone: string | null;
  service_center_location: unknown;
  work_day_start: string | null;
  work_day_end: string | null;
  lesson_duration_minutes: number | null;
  buffer_minutes_between_lessons: number | null;
  service_radius_km: string | null;
  max_segment_travel_time_min: number | null;
  max_segment_travel_distance_km: string | null;
  daily_max_travel_time_min: number | null;
  daily_max_travel_distance_km: string | null;
  notes: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DriverProfile {
  id: number;
  userId: number;
  drivingSchoolId: number;
  fullName: string;
  phone: string | null;
  serviceCenterLocation: unknown;
  workDayStart: string | null;
  workDayEnd: string | null;
  lessonDurationMinutes: number | null;
  bufferMinutesBetweenLessons: number | null;
  serviceRadiusKm: string | null;
  maxSegmentTravelTimeMin: number | null;
  maxSegmentTravelDistanceKm: string | null;
  dailyMaxTravelTimeMin: number | null;
  dailyMaxTravelDistanceKm: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfileRow {
  id: number;
  user_id: number;
  driving_school_id: number;
  full_name: string;
  date_of_birth: Date | null;
  phone: string | null;
  email: string | null;
  licence_number: string | null;
  licence_expiry_date: Date | null;
  licence_province_or_state: string | null;
  licence_image_url: string | null;
  licence_status: LicenceStatus;
  licence_rejection_note: string | null;
  allowed_hours: number | null;
  max_lessons_per_day: number | null;
  is_minor: boolean;
  guardian_phone: string | null;
  guardian_email: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StudentProfile {
  id: number;
  userId: number;
  drivingSchoolId: number;
  fullName: string;
  dateOfBirth: Date | null;
  phone: string | null;
  email: string | null;
  licenceNumber: string | null;
  licenceExpiryDate: Date | null;
  licenceProvinceOrState: string | null;
  licenceImageUrl: string | null;
  licenceStatus: LicenceStatus;
  licenceRejectionNote: string | null;
  allowedHours: number | null;
  maxLessonsPerDay: number | null;
  isMinor: boolean;
  guardianPhone: string | null;
  guardianEmail: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const mapDrivingSchool = (row: DrivingSchoolRow): DrivingSchool => ({
  id: Number(row.id),
  name: row.name,
  legalName: row.legal_name,
  contactEmail: row.contact_email,
  contactPhone: row.contact_phone,
  addressLine1: row.address_line1,
  addressLine2: row.address_line2,
  city: row.city,
  provinceOrState: row.province_or_state,
  postalCode: row.postal_code,
  country: row.country,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapUser = (row: UserRow): User => ({
  id: Number(row.id),
  drivingSchoolId: row.driving_school_id === null ? null : Number(row.driving_school_id),
  email: row.email,
  identityProvider: row.identity_provider,
  identitySubject: row.identity_subject,
  passwordHash: row.password_hash,
  role: row.role,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapDriverProfile = (row: DriverProfileRow): DriverProfile => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  drivingSchoolId: Number(row.driving_school_id),
  fullName: row.full_name,
  phone: row.phone,
  serviceCenterLocation: row.service_center_location,
  workDayStart: row.work_day_start,
  workDayEnd: row.work_day_end,
  lessonDurationMinutes: row.lesson_duration_minutes,
  bufferMinutesBetweenLessons: row.buffer_minutes_between_lessons,
  serviceRadiusKm: row.service_radius_km,
  maxSegmentTravelTimeMin: row.max_segment_travel_time_min,
  maxSegmentTravelDistanceKm: row.max_segment_travel_distance_km,
  dailyMaxTravelTimeMin: row.daily_max_travel_time_min,
  dailyMaxTravelDistanceKm: row.daily_max_travel_distance_km,
  notes: row.notes,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapStudentProfile = (row: StudentProfileRow): StudentProfile => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  drivingSchoolId: Number(row.driving_school_id),
  fullName: row.full_name,
  dateOfBirth: row.date_of_birth,
  phone: row.phone,
  email: row.email,
  licenceNumber: row.licence_number,
  licenceExpiryDate: row.licence_expiry_date,
  licenceProvinceOrState: row.licence_province_or_state,
  licenceImageUrl: row.licence_image_url,
  licenceStatus: row.licence_status,
  licenceRejectionNote: row.licence_rejection_note,
  allowedHours: row.allowed_hours,
  maxLessonsPerDay: row.max_lessons_per_day,
  isMinor: row.is_minor ?? false,
  guardianPhone: row.guardian_phone,
  guardianEmail: row.guardian_email,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface StudentAddressRow {
  id: number;
  driving_school_id: number;
  student_id: number | null;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  province_or_state: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default_pickup: boolean;
  is_default_dropoff: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StudentAddress {
  id: number;
  drivingSchoolId: number;
  studentId: number | null;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  provinceOrState: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefaultPickup: boolean;
  isDefaultDropoff: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const mapStudentAddress = (row: StudentAddressRow): StudentAddress => ({
  id: Number(row.id),
  drivingSchoolId: Number(row.driving_school_id),
  studentId: row.student_id === null ? null : Number(row.student_id),
  label: row.label,
  line1: row.line1,
  line2: row.line2,
  city: row.city,
  provinceOrState: row.province_or_state,
  postalCode: row.postal_code,
  country: row.country,
  latitude: row.latitude,
  longitude: row.longitude,
  isDefaultPickup: row.is_default_pickup,
  isDefaultDropoff: row.is_default_dropoff,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface BookingRow {
  id: number;
  driving_school_id: number;
  student_id: number;
  driver_id: number;
  pickup_address_id: number | null;
  dropoff_address_id: number | null;
  start_time: Date;
  end_time: Date;
  status: BookingStatus;
  cancellation_reason_code: string | null;
  price_amount: string | null;
  notes: string | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Booking {
  id: number;
  drivingSchoolId: number;
  studentId: number;
  driverId: number;
  pickupAddressId: number | null;
  dropoffAddressId: number | null;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  cancellationReasonCode: string | null;
  priceAmount: string | null;
  notes: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const mapBooking = (row: BookingRow): Booking => ({
  id: Number(row.id),
  drivingSchoolId: Number(row.driving_school_id),
  studentId: Number(row.student_id),
  driverId: Number(row.driver_id),
  pickupAddressId: row.pickup_address_id === null ? null : Number(row.pickup_address_id),
  dropoffAddressId: row.dropoff_address_id === null ? null : Number(row.dropoff_address_id),
  startTime: row.start_time,
  endTime: row.end_time,
  status: row.status,
  cancellationReasonCode: row.cancellation_reason_code,
  priceAmount: row.price_amount,
  notes: row.notes,
  cancelledAt: row.cancelled_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface DriverAvailabilityRow {
  id: number;
  driving_school_id: number;
  driver_id: number;
  date: Date;
  start_time: string;
  end_time: string;
  type: AvailabilityType;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DriverAvailability {
  id: number;
  drivingSchoolId: number;
  driverId: number;
  date: Date;
  startTime: string;
  endTime: string;
  type: AvailabilityType;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const mapDriverAvailability = (row: DriverAvailabilityRow): DriverAvailability => ({
  id: Number(row.id),
  drivingSchoolId: Number(row.driving_school_id),
  driverId: Number(row.driver_id),
  date: row.date,
  startTime: row.start_time,
  endTime: row.end_time,
  type: row.type,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface SchoolSettingsRow {
  id: number;
  driving_school_id: number;
  min_booking_lead_time_hours: number | null;
  cancellation_cutoff_hours: number | null;
  default_lesson_duration_minutes: number | null;
  default_buffer_minutes_between_lessons: number | null;
  default_service_radius_km: string | null;
  default_max_segment_travel_time_min: number | null;
  default_max_segment_travel_distance_km: string | null;
  default_daily_max_travel_time_min: number | null;
  default_daily_max_travel_distance_km: string | null;
  daily_booking_cap_per_driver: number | null;
  allow_student_to_pick_driver: boolean;
  allow_driver_self_availability_edit: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SchoolSettings {
  id: number;
  drivingSchoolId: number;
  minBookingLeadTimeHours: number | null;
  cancellationCutoffHours: number | null;
  defaultLessonDurationMinutes: number | null;
  defaultBufferMinutesBetweenLessons: number | null;
  defaultServiceRadiusKm: string | null;
  defaultMaxSegmentTravelTimeMin: number | null;
  defaultMaxSegmentTravelDistanceKm: string | null;
  defaultDailyMaxTravelTimeMin: number | null;
  defaultDailyMaxTravelDistanceKm: string | null;
  dailyBookingCapPerDriver: number | null;
  allowStudentToPickDriver: boolean;
  allowDriverSelfAvailabilityEdit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const mapSchoolSettings = (row: SchoolSettingsRow): SchoolSettings => ({
  id: Number(row.id),
  drivingSchoolId: Number(row.driving_school_id),
  minBookingLeadTimeHours: row.min_booking_lead_time_hours,
  cancellationCutoffHours: row.cancellation_cutoff_hours,
  defaultLessonDurationMinutes: row.default_lesson_duration_minutes,
  defaultBufferMinutesBetweenLessons: row.default_buffer_minutes_between_lessons,
  defaultServiceRadiusKm: row.default_service_radius_km,
  defaultMaxSegmentTravelTimeMin: row.default_max_segment_travel_time_min,
  defaultMaxSegmentTravelDistanceKm: row.default_max_segment_travel_distance_km,
  defaultDailyMaxTravelTimeMin: row.default_daily_max_travel_time_min,
  defaultDailyMaxTravelDistanceKm: row.default_daily_max_travel_distance_km,
  dailyBookingCapPerDriver: row.daily_booking_cap_per_driver,
  allowStudentToPickDriver: row.allow_student_to_pick_driver,
  allowDriverSelfAvailabilityEdit: row.allow_driver_self_availability_edit,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface SchoolInvitationRow {
  id: number;
  driving_school_id: number;
  email: string;
  role: UserRole;
  token: string;
  expires_at: Date;
  accepted_at: Date | null;
  full_name: string | null;
  allowed_hours: number | null;
  max_lessons_per_day: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SchoolInvitation {
  id: number;
  drivingSchoolId: number;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  fullName: string | null;
  allowedHours: number | null;
  maxLessonsPerDay: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export const mapSchoolInvitation = (row: SchoolInvitationRow): SchoolInvitation => ({
  id: Number(row.id),
  drivingSchoolId: Number(row.driving_school_id),
  email: row.email,
  role: row.role,
  token: row.token,
  expiresAt: row.expires_at,
  acceptedAt: row.accepted_at,
  fullName: row.full_name,
  allowedHours: row.allowed_hours,
  maxLessonsPerDay: row.max_lessons_per_day,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
