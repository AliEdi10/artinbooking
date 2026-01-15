-- seed demo data (placeholder)

-- Demo driving school
INSERT INTO driving_schools (id, name, contact_email, contact_phone, city, province_or_state, country)
VALUES (200, 'Downtown Demo Driving', 'hello@downtowndemo.test', '+1-555-999-0000', 'Calgary', 'AB', 'CA')
ON CONFLICT (id) DO NOTHING;

INSERT INTO school_settings (driving_school_id, min_booking_lead_time_hours, cancellation_cutoff_hours, default_lesson_duration_minutes)
VALUES (200, 12, 6, 45)
ON CONFLICT (driving_school_id) DO NOTHING;

-- Demo users
INSERT INTO users (id, driving_school_id, email, identity_provider, identity_subject, role, status)
VALUES
    (210, 200, 'demo-admin@downtowndemo.test', 'google', 'demo-admin-sub', 'SCHOOL_ADMIN', 'active'),
    (211, 200, 'demo-driver@downtowndemo.test', 'google', 'demo-driver-sub', 'DRIVER', 'active'),
    (212, 200, 'demo-student@downtowndemo.test', 'google', 'demo-student-sub', 'STUDENT', 'active')
ON CONFLICT (id) DO NOTHING;

-- Driver profile
INSERT INTO driver_profiles (id, user_id, driving_school_id, full_name, phone, work_day_start, work_day_end, lesson_duration_minutes, buffer_minutes_between_lessons, service_radius_km)
VALUES (310, 211, 200, 'Drew Demo', '+1-555-111-2222', '09:00', '17:00', 45, 15, 10.0)
ON CONFLICT (id) DO NOTHING;

-- Student profile
INSERT INTO student_profiles (id, user_id, driving_school_id, full_name, phone, email, licence_status)
VALUES (410, 212, 200, 'Sasha Sample', '+1-555-222-3333', 'demo-student@downtowndemo.test', 'approved')
ON CONFLICT (id) DO NOTHING;

-- Student addresses
INSERT INTO addresses (id, driving_school_id, student_id, label, line1, city, province_or_state, postal_code, country, is_default_pickup, is_default_dropoff)
VALUES
    (510, 200, 410, 'Home', '10 Demo Crescent', 'Calgary', 'AB', 'T2P 1J9', 'CA', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Driver availability and booking sample
INSERT INTO driver_availability (id, driving_school_id, driver_id, date, start_time, end_time, type)
VALUES (610, 200, 310, CURRENT_DATE + INTERVAL '2 days', '10:00', '12:00', 'working_hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bookings (id, driving_school_id, student_id, driver_id, pickup_address_id, start_time, end_time, status, notes)
VALUES (
    710,
    200,
    410,
    310,
    510,
    CURRENT_DATE + INTERVAL '2 days' + TIME '10:00',
    CURRENT_DATE + INTERVAL '2 days' + TIME '10:45',
    'scheduled',
    'Demo booking for wiring tests'
)
ON CONFLICT (id) DO NOTHING;
