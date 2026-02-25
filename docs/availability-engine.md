\# artinbk – Availability and Travel Logic



This document explains the core availability engine that returns feasible lesson slots for a given instructor, day and requested pickup/drop-off locations.



The actual implementation will be in TypeScript in the backend, but this describes the concepts and rules.



\## 1. Key inputs and concepts



\### 1.1 Instructor configuration



Per instructor the system tracks:



\- service\_center\_location

\- work\_day\_start, work\_day\_end

\- lesson\_duration\_minutes (L)

\- buffer\_minutes\_between\_lessons (B)

\- service\_radius\_km

\- max\_segment\_travel\_time\_min (T\_max)

\- max\_segment\_travel\_distance\_km (D\_max)

\- daily\_max\_travel\_time\_min (optional)

\- daily\_max\_travel\_distance\_km (optional)



These parameters drive what is considered feasible for that instructor.



\### 1.2 Booking



Each booking has:



\- pickup\_location (P)

\- dropoff\_location (D)

\- start\_time (S) (pickup time)

\- end\_time (E) = S + L

\- driver\_id, student\_id

\- driving\_school\_id



Bookings are considered fixed once accepted. They form “busy blocks” for the availability engine.



\### 1.3 Events and gaps



For a single day and a single instructor:



\- We construct a list of events that represent busy periods.

\- Each event i has:

&nbsp; - start\_time = booking.start\_time (or work\_day\_start)

&nbsp; - end\_time = booking.end\_time (or work\_day\_end)

&nbsp; - start\_location (pickup location or service center)

&nbsp; - end\_location (drop-off location or service center)



From this sorted list of events we derive gaps:



\- A gap is the open interval between event i and event i+1.

\- Each gap is defined by:

&nbsp; - gap\_start\_time, gap\_end\_time

&nbsp; - gap\_start\_location (end\_location of event i)

&nbsp; - gap\_end\_location (start\_location of event i+1)



The availability engine tries to insert a new booking into one of these gaps without violating any rules.



\### 1.4 Time grid



The engine works on a 15-minute grid:



\- All candidate start times S are rounded to the nearest 15-minute boundary.

\- The returned slots are all 15-minute increments within the day.



\## 2. External functions



The engine relies on two external functions that will be backed by a real maps/travel API:



\- travel(from\_location, to\_location, departure\_time) → (time\_min, distance\_km)

\- distance\_between(from\_location, to\_location) → distance\_km



distance\_between is used for quick radius checks; travel is used to compute actual drive times between bookings and between base and bookings.



\### 1.5 Driver availability overrides

Drivers can customize their working hours per specific date through availability entries stored in the `driver_availability` table. Three types of entries are supported:

\- **working\_hours** — Replaces the default work\_day\_start/work\_day\_end for that date. Multiple working\_hours entries define split shifts.

\- **override\_open** — Extends availability beyond the base window (merged with working\_hours via interval union).

\- **override\_closed** — Blocks out a time range (subtracted from all open windows). Used for breaks, appointments, etc.

The engine first builds base windows (from working\_hours entries, or the driver's default work day if none exist), merges in override\_open entries, then subtracts all override\_closed intervals. The result is a set of non-overlapping open windows for the day.



\## 3. Day-boundary travel exemptions

Travel time is **not enforced at work day start or end boundaries**. The driver is expected to handle their own commute to/from the service center. Travel time (and buffer) is only enforced between consecutive bookings within the day.

This means:
\- The first slot of the day can start right at work\_day\_start regardless of how far the pickup is from the service center.
\- The last slot can end right at work\_day\_end regardless of how far the dropoff is from the service center.
\- Between bookings, travel time from the previous dropoff to the next pickup IS enforced, along with the buffer.



\## 4. Behaviour for an empty day



If the instructor has no bookings on that day:



1\) We consider the entire \[work\_day\_start, work\_day\_end] as a single gap (or multiple gaps if availability overrides define split windows).

2\) For each candidate start time S on the 15-minute grid:

&nbsp;  - Compute new\_end = S + L.

&nbsp;  - Check S ≥ work\_day\_start and new\_end ≤ work\_day\_end.

&nbsp;  - Check distance\_between(service\_center\_location, pickup\_location) ≤ service\_radius\_km.

&nbsp;  - Service radius and per-segment travel limits are still checked.

&nbsp;  - Day-boundary travel exemption applies (see section 3) — travel time to/from base is not deducted.

&nbsp;  - If daily caps are set, projected travel totals must stay within limits.



3\) All valid start times S are returned. Since this is the first booking of the day, **all feasible slots are offered** (compact scheduling only restricts when bookings already exist — see section 6).



\## 5. Behaviour with existing bookings



When there are existing bookings that day:



1\) Build events:



&nbsp;  - Start with an initial event representing “start of day at base”:

&nbsp;    - start\_time = work\_day\_start

&nbsp;    - end\_time = work\_day\_start

&nbsp;    - start\_location = service\_center\_location

&nbsp;    - end\_location = service\_center\_location



&nbsp;  - For each booking, create an event with:

&nbsp;    - start\_time = booking.start\_time

&nbsp;    - end\_time = booking.end\_time

&nbsp;    - start\_location = booking.pickup\_location

&nbsp;    - end\_location = booking.dropoff\_location



&nbsp;  - Add a final event representing “end of day at base”:

&nbsp;    - start\_time = work\_day\_end

&nbsp;    - end\_time = work\_day\_end

&nbsp;    - start\_location = service\_center\_location

&nbsp;    - end\_location = service\_center\_location



&nbsp;  - Sort events by start\_time.



2\) Derive gaps between events:



&nbsp;  For each consecutive pair (event i, event i+1):



&nbsp;  - gap\_start\_time = event\_i.end\_time

&nbsp;  - gap\_end\_time = event\_{i+1}.start\_time

&nbsp;  - gap\_start\_location = event\_i.end\_location

&nbsp;  - gap\_end\_location = event\_{i+1}.start\_location



3\) For each gap, attempt to fit a new booking:



&nbsp;  - The target booking has pickup\_location P\_new and dropoff\_location D\_new.

&nbsp;  - The candidate start times S are on the 15-minute grid within \[gap\_start\_time, gap\_end\_time].



&nbsp;  For each candidate S:



&nbsp;  a) Compute new\_end = S + L.



&nbsp;  b) Check that the booking fits within the gap with buffers:

&nbsp;     - gap\_start\_time + B ≤ S

&nbsp;     - new\_end + B ≤ gap\_end\_time



&nbsp;  c) Check service radius:

&nbsp;     - distance\_between(service\_center\_location, P\_new) ≤ service\_radius\_km

&nbsp;     - Optionally also check D\_new within radius.



&nbsp;  d) Compute travel from previous end to new pickup:

&nbsp;     - (t\_prev, d\_prev) = travel(gap\_start\_location, P\_new, S).

&nbsp;     - Check S ≥ gap\_start\_time + t\_prev + B.

&nbsp;     - Check t\_prev ≤ T\_max, d\_prev ≤ D\_max.



&nbsp;  e) Compute travel from new dropoff to next start:

&nbsp;     - new\_end = S + L

&nbsp;     - (t\_next, d\_next) = travel(D\_new, gap\_end\_location, new\_end).

&nbsp;     - Check gap\_end\_time ≥ new\_end + t\_next + B.

&nbsp;     - Check t\_next ≤ T\_max, d\_next ≤ D\_max.



&nbsp;  f) Apply daily caps if configured:

&nbsp;     - For the full day, sum of travel times and distances (existing bookings + this candidate) must not exceed:

&nbsp;       - daily\_max\_travel\_time\_min

&nbsp;       - daily\_max\_travel\_distance\_km



&nbsp;  If all checks pass, S is a feasible start time in that gap.

&nbsp;  **Day-boundary travel exemption (section 3):** At the first gap (after work\_day\_start) and last gap (before work\_day\_end), travel time to/from the service center is not enforced.



4\) Apply compact scheduling filter (section 6) to each gap's feasible slots.



5\) Aggregate feasible slots:



&nbsp;  - Collect all S across all gaps that pass the checks and compact filter.

&nbsp;  - Remove duplicates and sort chronologically.

&nbsp;  - Return the final array of available slots.



\## 6. Compact scheduling

When the driver already has bookings on the day, new slots are restricted to be **adjacent to existing bookings**. This prevents idle gaps in the instructor's schedule — the instructor should never be free for more than the buffer time between lessons.

Rules per gap:

\- **No bookings on the day:** All feasible slots in all gaps are offered (first booking can go anywhere).

\- **Gap between two bookings:** Only the earliest slot (adjacent to the previous booking) and the latest slot (adjacent to the next booking) are offered.

\- **Gap after last booking → window end:** Only the earliest slot (right after the last booking) is offered.

\- **Gap from window start → first booking:** Only the latest slot (right before the first booking) is offered.

\- **Entire window open but bookings exist in other windows:** All slots are offered (driver needs to start somewhere in that window).

Example: Driver works 9am–5pm with a 60-min lesson at 12:00–1:00pm (zero travel, zero buffer).
\- Without compact scheduling: 9:00, 9:15, 9:30, ..., 11:00, 1:00, 1:15, ..., 4:00 (29 slots).
\- With compact scheduling: only 11:00 (right before the booking) and 1:00 (right after the booking).



\## 7. Policy integration



The availability engine works in combination with school and platform policies:



\- Minimum lead time:

&nbsp; - The frontend should only ask for slots starting at now + min\_lead\_time\_hours.

\- Cancellation rules:

&nbsp; - Cancelling a booking frees up a slot only if the cancellation is allowed.

\- Student licence status:

&nbsp; - Even if a slot is technically available, the booking creation must be blocked if the student’s licence status does not allow new bookings.



These policies are enforced at the API level (for example, before calling get\_available\_slots or before creating a booking).



\## 8. Implementation notes



\- The engine is implemented in TypeScript at `backend/src/services/availability.ts`.

\- Travel calculations use Google Maps Distance Matrix API via `backend/src/services/travelProvider.ts`. When no API key is configured, a haversine-based fallback at 40 km/h average speed is used.

\- 49 unit tests in `backend/tests/unit/availability.test.ts` validate:

&nbsp; - Empty day behaviour (15-minute grid, correct slot count).

&nbsp; - Overlap detection with existing bookings.

&nbsp; - Compact scheduling (only adjacent slots offered).

&nbsp; - Travel-time constraint violations.

\- All times use America/Halifax timezone (configured via `TZ=America/Halifax` in the backend entrypoint).



