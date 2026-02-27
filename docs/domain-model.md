# artinbk – Domain Model Overview

This document describes the main entities and relationships in the system. It is a conceptual view, not a full SQL schema.

**Last Updated: February 27, 2026**

## 1. DrivingSchool

Represents a single driving school (tenant).

Key fields:

- id
- name
- legal\_name
- contact\_email
- contact\_phone
- address (office address: line1, line2, city, province\_or\_state, postal\_code, country)
- status (active, suspended, deleted) - **PostgreSQL enum type**
- created\_at, updated\_at

**Important Notes:**

- Schools are created with `status='suspended'` initially
- Schools activate automatically when a SCHOOL\_ADMIN user accepts their invitation and completes registration
- Frontend must use `status` field (not a boolean `active` field) to check school state
- Valid status transitions: suspended → active, active → suspended, \* → deleted

Relationships:

- Has many Users (admins, drivers, students).
- Has many Bookings.
- Has one SchoolSettings record.
- Has many SchoolEmailTemplates.

## 2. User

Represents an authenticated person in the system (superadmin, school admin, driver, student).

Key fields:

- id
- driving\_school\_id (nullable for superadmin, required otherwise)
- email (unique per user)
- identity\_provider, identity\_subject (for external auth)
- password\_hash (for local auth, bcrypt)
- role (SUPERADMIN, SCHOOL\_ADMIN, DRIVER, STUDENT) - **PostgreSQL enum type**
- status (active, disabled) - **PostgreSQL enum type**
- created\_at, updated\_at

Relationships:

- For DRIVER role, links to one DriverProfile.
- For STUDENT role, links to one StudentProfile.

## 3. DriverProfile

Represents the operational profile of an instructor.

Key fields:

- id
- user\_id (DRIVER)
- driving\_school\_id
- full\_name
- phone
- email (separate contact email, may differ from User email)
- service\_center\_location (geocoded point: latitude, longitude)
- work\_day\_start, work\_day\_end (default daily working hours)
- lesson\_duration\_minutes (L)
- buffer\_minutes\_between\_lessons (B)
- service\_radius\_km
- max\_segment\_travel\_time\_min (T\_max)
- max\_segment\_travel\_distance\_km (D\_max)
- daily\_max\_travel\_time\_min (optional)
- daily\_max\_travel\_distance\_km (optional)
- notes
- active (boolean)
- created\_at, updated\_at

Relationships:

- Has many DriverAvailability windows.
- Has many Bookings.

## 4. StudentProfile

Represents a student/client of a driving school.

Key fields:

- id
- user\_id (STUDENT)
- driving\_school\_id
- full\_name
- date\_of\_birth
- phone
- email (may mirror User email)
- licence\_number
- licence\_expiry\_date
- licence\_province\_or\_state
- licence\_image\_url (stored as URL)
- licence\_status (pending\_review, approved, rejected) - **PostgreSQL enum type**
- licence\_rejection\_note (optional admin note on rejection)
- allowed\_hours (nullable — max booking hours, null = unlimited)
- max\_lessons\_per\_day (nullable — max bookings per day, null = unlimited)
- is\_minor (boolean, default false)
- guardian\_phone (nullable — required if is\_minor)
- guardian\_email (nullable — required if is\_minor; used for guardian email CC)
- active (boolean)
- created\_at, updated\_at

Relationships:

- Has many Addresses.
- Has many Bookings.

## 5. Address (StudentAddress)

Represents a location associated with a student.

Key fields:

- id
- student\_id
- driving\_school\_id
- label (Home, Work, School, etc.)
- line1, line2, city, province\_or\_state, postal\_code, country
- latitude, longitude (geocoded)
- is\_default\_pickup (boolean)
- is\_default\_dropoff (boolean)
- active (boolean)
- created\_at, updated\_at

Relationships:

- Used as pickup\_location or dropoff\_location in Bookings.

## 6. Booking

Represents a scheduled lesson or session.

Key fields:

- id
- driving\_school\_id
- student\_id
- driver\_id
- pickup\_address\_id (reference to Address)
- dropoff\_address\_id
- start\_time (pickup datetime)
- end\_time (dropoff datetime)
- status (scheduled, completed, cancelled\_by\_student, cancelled\_by\_driver, cancelled\_by\_school) - **PostgreSQL enum type**
- cancellation\_reason\_code (optional)
- price\_amount (optional, for future billing integration)
- notes
- reminder\_sent\_at (nullable — set when lesson reminder email is sent)
- cancelled\_at (optional)
- created\_at, updated\_at

Relationships:

- Belongs to one DrivingSchool.
- Belongs to one StudentProfile and one DriverProfile.
- Uses two Address records (pickup and drop-off).
- Contributes to availability calculations for that driver.

## 7. DriverAvailability

Represents availability windows and other constraints for a driver.

Key fields:

- id
- driving\_school\_id
- driver\_id
- date (the day this availability applies to)
- start\_time
- end\_time
- type (working\_hours, override\_open, override\_closed) - **PostgreSQL enum type**
- notes
- created\_at, updated\_at

Usage:

- Used by the availability engine together with existing bookings to compute open slots for the day.
- `working_hours` — replaces default work day for that date.
- `override_open` — extends availability beyond base window.
- `override_closed` — blocks time range (holidays, breaks).

## 8. SchoolSettings

Represents per-school policy configuration.

Key fields:

- id
- driving\_school\_id (unique)
- min\_booking\_lead\_time\_hours
- cancellation\_cutoff\_hours
- default\_lesson\_duration\_minutes
- default\_buffer\_minutes\_between\_lessons
- default\_service\_radius\_km
- default\_max\_segment\_travel\_time\_min
- default\_max\_segment\_travel\_distance\_km
- default\_daily\_max\_travel\_time\_min (optional)
- default\_daily\_max\_travel\_distance\_km (optional)
- daily\_booking\_cap\_per\_driver (optional — max bookings per driver per day)
- allow\_student\_to\_pick\_driver (boolean, default true)
- allow\_driver\_self\_availability\_edit (boolean, default true)
- reminder\_hours\_before (integer, default 24 — configurable 1-168 hours)
- created\_at, updated\_at

These settings are used as defaults for new drivers and bookings, but may be overridden at driver level.

## 9. SchoolEmailTemplates

Per-school customizable email templates for transactional emails.

Key fields:

- id
- driving\_school\_id
- template\_key (booking\_confirmation, booking\_cancelled, lesson\_reminder, invitation)
- subject (nullable — custom subject line, null = use default)
- custom\_note (nullable — plain-text note injected at top of email body)
- updated\_at

Usage:

- Admins can customize the subject line and add a custom note to each of the 4 email types.
- Subject supports `{varName}` interpolation (e.g., `{studentName}`, `{lessonDate}`, `{schoolName}`).
- Custom note is rendered as a styled block at the top of the email body.
- Falls back to hardcoded defaults when no custom template exists.

Unique constraint: (driving\_school\_id, template\_key).

## 10. SchoolInvitation

Represents an invitation to join a school as a driver or student.

Key fields:

- id
- driving\_school\_id
- email
- role (DRIVER, STUDENT, SCHOOL\_ADMIN)
- token (unique invite token)
- expires\_at
- accepted\_at (nullable — set when invitation is accepted)
- full\_name
- allowed\_hours (for STUDENT invitations)
- max\_lessons\_per\_day (for STUDENT invitations)
- created\_at, updated\_at

## 11. AuditLog

Records who did what and when for compliance and debugging.

Key fields:

- id
- driving\_school\_id
- actor\_user\_id
- action (text describing the action)
- entity\_type, entity\_id (what was affected)
- details (JSONB — additional context)
- created\_at

## 12. PasswordResetToken

Secure one-time-use tokens for password reset flow.

Key fields:

- id
- user\_id
- token (unique, hashed)
- expires\_at (1 hour expiry)
- used\_at (nullable — set when token is consumed)
- created\_at
