-- Seed a sample driving school with admin, driver, student, and a demo booking
-- Password hash is bcrypt for the string "changeme" for local use only.

-- School core record
INSERT INTO driving_schools (id, name, legal_name, contact_email, contact_phone, address_line1, city, province_or_state, postal_code, country)
VALUES (
    100,
    'Brightside Driving School',
    'Brightside Driving Ltd.',
    'info@brightsidedriving.test',
    '+1-902-123-4567',
    '123 Spring Garden Rd',
    'Halifax',
    'NS',
    'B3J 2K9',
    'CA'
) ON CONFLICT (id) DO NOTHING;

-- School-level settings
INSERT INTO school_settings (driving_school_id, min_booking_lead_time_hours, cancellation_cutoff_hours, default_lesson_duration_minutes, default_buffer_minutes_between_lessons, default_service_radius_km, default_max_segment_travel_time_min, default_max_segment_travel_distance_km, allow_student_to_pick_driver, allow_driver_self_availability_edit)
VALUES (
    100,
    24,
    12,
    60,
    15,
    15.0,
    45,
    30.0,
    TRUE,
    TRUE
) ON CONFLICT (driving_school_id) DO NOTHING;

-- Users
INSERT INTO users (id, driving_school_id, email, identity_provider, identity_subject, role, status)
VALUES
    (101, 100, 'admin@brightside.test', 'google', 'brightside-admin-sub', 'SCHOOL_ADMIN', 'active'),
    (102, 100, 'driver@brightside.test', 'google', 'brightside-driver-sub', 'DRIVER', 'active'),
    (103, 100, 'student@brightside.test', 'google', 'brightside-student-sub', 'STUDENT', 'active')
ON CONFLICT (id) DO NOTHING;

-- Driver profile
INSERT INTO driver_profiles (id, user_id, driving_school_id, full_name, phone, work_day_start, work_day_end, lesson_duration_minutes, buffer_minutes_between_lessons, service_radius_km, max_segment_travel_time_min, max_segment_travel_distance_km, notes)
VALUES (
    201,
    102,
    100,
    'Dana Driver',
    '+1-555-200-0001',
    '08:00',
    '18:00',
    60,
    10,
    20.0,
    45,
    30.0,
    'Weekday lessons only'
) ON CONFLICT (id) DO NOTHING;

-- Student profile
INSERT INTO student_profiles (id, user_id, driving_school_id, full_name, date_of_birth, phone, email, licence_number, licence_expiry_date, licence_province_or_state, licence_status)
VALUES (
    301,
    103,
    100,
    'Sam Student',
    '1999-03-12',
    '+1-902-300-0001',
    'student@brightside.test',
    'S123-456-789',
    '2028-03-31',
    'NS',
    'approved'
) ON CONFLICT (id) DO NOTHING;

-- Addresses
INSERT INTO addresses (id, driving_school_id, student_id, label, line1, city, province_or_state, postal_code, country, latitude, longitude, is_default_pickup, is_default_dropoff)
VALUES
    (401, 100, 301, 'Home', '1256 Barrington St', 'Halifax', 'NS', 'B3J 1Y6', 'CA', 44.6453, -63.5764, TRUE, FALSE),
    (402, 100, 301, 'Campus', '6299 South St', 'Halifax', 'NS', 'B3H 4R2', 'CA', 44.6365, -63.5917, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Availability
INSERT INTO driver_availability (id, driving_school_id, driver_id, date, start_time, end_time, type, notes)
VALUES
    (501, 100, 201, CURRENT_DATE + INTERVAL '1 day', '09:00', '12:00', 'working_hours', 'Morning blocks'),
    (502, 100, 201, CURRENT_DATE + INTERVAL '1 day', '13:00', '16:00', 'working_hours', 'Afternoon blocks')
ON CONFLICT (id) DO NOTHING;

-- Booking tying everything together
INSERT INTO bookings (id, driving_school_id, student_id, driver_id, pickup_address_id, dropoff_address_id, start_time, end_time, status, notes)
VALUES (
    601,
    100,
    301,
    201,
    401,
    402,
    CURRENT_DATE + INTERVAL '1 day' + TIME '09:00',
    CURRENT_DATE + INTERVAL '1 day' + TIME '10:00',
    'scheduled',
    'Intro lesson'
) ON CONFLICT (id) DO NOTHING;

-- Example audit entries
INSERT INTO audit_logs (id, driving_school_id, actor_user_id, action, entity_type, entity_id, details)
VALUES
    (701, 100, 101, 'school_settings.updated', 'school_settings', 100, '{"cancellation_cutoff_hours": 12}'),
    (702, 100, 101, 'booking.created', 'bookings', 601, '{"notes": "Intro lesson"}')
ON CONFLICT (id) DO NOTHING;
