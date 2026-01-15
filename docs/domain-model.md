\# artinbk – Domain Model Overview



This document describes the main entities and relationships in the system. It is a conceptual view, not a full SQL schema.



\## 1. DrivingSchool



Represents a single driving school (tenant).



Key fields (conceptual):



\- id

\- name

\- legal\_name

\- contact\_email

\- contact\_phone

\- address (office address)

\- status (active, suspended, deleted)

\- created\_at, updated\_at



Relationships:



\- Has many Users (admins, drivers, students).

\- Has many Bookings.

\- Has many SchoolSettings records (if split by category).



\## 2. User



Represents an authenticated person in the system (superadmin, school admin, driver, student).



Key fields:



\- id

\- driving\_school\_id (nullable for superadmin, required otherwise)

\- email (unique per user)

\- password\_hash or external auth identifier

\- role (SUPERADMIN, SCHOOL\_ADMIN, DRIVER, STUDENT)

\- status (active, disabled)

\- created\_at, updated\_at



Relationships:



\- For DRIVER role, links to one DriverProfile.

\- For STUDENT role, links to one StudentProfile.



\## 3. DriverProfile



Represents the operational profile of an instructor.



Key fields:



\- id

\- user\_id (DRIVER)

\- driving\_school\_id

\- full\_name

\- phone

\- service\_center\_location (geocoded point)

\- work\_day\_start, work\_day\_end (default daily working hours)

\- lesson\_duration\_minutes (L)

\- buffer\_minutes\_between\_lessons (B)

\- service\_radius\_km

\- max\_segment\_travel\_time\_min (T\_max)

\- max\_segment\_travel\_distance\_km (D\_max)

\- daily\_max\_travel\_time\_min (optional)

\- daily\_max\_travel\_distance\_km (optional)

\- notes

\- active (boolean)

\- created\_at, updated\_at



Relationships:



\- Has many DriverAvailability windows.

\- Has many Bookings.



\## 4. StudentProfile



Represents a student/client of a driving school.



Key fields:



\- id

\- user\_id (STUDENT)

\- driving\_school\_id

\- full\_name

\- date\_of\_birth

\- phone

\- email (may mirror User email)

\- licence\_number

\- licence\_expiry\_date

\- licence\_province\_or\_state

\- licence\_image\_url (stored in GCS)

\- licence\_status (pending\_review, approved, rejected)

\- active (boolean)

\- created\_at, updated\_at



Relationships:



\- Has many StudentAddresses.

\- Has many Bookings.



\## 5. StudentAddress



Represents a location associated with a student.



Key fields:



\- id

\- student\_id

\- driving\_school\_id

\- label (Home, Work, School, etc.)

\- line1, line2, city, province, postal\_code, country

\- latitude, longitude (geocoded)

\- is\_default\_pickup (boolean)

\- is\_default\_dropoff (boolean)

\- active (boolean)

\- created\_at, updated\_at



Relationships:



\- Used as pickup\_location or dropoff\_location in Bookings.



\## 6. Booking



Represents a scheduled lesson or session.



Key fields:



\- id

\- driving\_school\_id

\- student\_id

\- driver\_id

\- pickup\_address\_id (reference to StudentAddress or another address type)

\- dropoff\_address\_id

\- start\_time (pickup datetime)

\- end\_time (dropoff datetime)

\- status (scheduled, completed, cancelled\_by\_student, cancelled\_by\_driver, cancelled\_by\_school)

\- cancellation\_reason\_code (optional)

\- price\_amount (optional, for future billing integration)

\- notes

\- created\_at, updated\_at, cancelled\_at (optional)



Relationships:



\- Belongs to one DrivingSchool.

\- Belongs to one StudentProfile and one DriverProfile.

\- Uses two address records (pickup and drop-off).

\- Contributes to availability calculations for that driver.



\## 7. DriverAvailability



Represents availability windows and other constraints for a driver.



Key fields:



\- id

\- driving\_school\_id

\- driver\_id

\- date (the day this availability applies to)

\- start\_time

\- end\_time

\- type (working\_hours, override\_open, override\_closed)

\- notes

\- created\_at, updated\_at



Usage:



\- Used by the availability engine together with existing bookings to compute open slots for the day.



\## 8. SchoolSettings



Represents per-school policy configuration.



Key fields:



\- id

\- driving\_school\_id

\- min\_booking\_lead\_time\_hours

\- cancellation\_cutoff\_hours

\- default\_lesson\_duration\_minutes

\- default\_buffer\_minutes\_between\_lessons

\- default\_service\_radius\_km

\- default\_max\_segment\_travel\_time\_min

\- default\_max\_segment\_travel\_distance\_km

\- default\_daily\_max\_travel\_time\_min (optional)

\- default\_daily\_max\_travel\_distance\_km (optional)

\- allow\_student\_to\_pick\_driver (boolean)

\- allow\_driver\_self\_availability\_edit (boolean)

\- created\_at, updated\_at



These settings are used as defaults for new drivers and bookings, but may be overridden at driver level.



\## 9. Audit and support entities (future)



The system will eventually include:



\- AuditLog: records who did what and when (for example, booking created, cancelled, licence approved).

\- NotificationLog: records emails and SMS messages sent for traceability.

\- SystemSettings or FeatureFlags: central configuration for platform-wide toggles.



These are not in code yet but should be accounted for in the schema design.



