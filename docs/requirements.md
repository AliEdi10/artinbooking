\# artinbk – Product and Requirements Overview



\## 1. Purpose and vision



artinbk is a single, multi-tenant web platform for driving schools. Each school can manage its own instructors, students, addresses, bookings and policies in one place. The platform runs in the cloud and is designed for:



\- Centralised administration across multiple driving schools.

\- Consistent enforcement of booking and availability rules.

\- Support for licence-based gating (no licence, no booking).

\- Route-aware scheduling so instructors are not overbooked or sent on unrealistic routes.



The application will ultimately run entirely on Google Cloud (Cloud Run, Cloud SQL, Cloud Storage, Cloud Build, Terraform-managed infrastructure).



\## 2. Tenancy model



The system is multi-tenant:



\- There are many driving schools.

\- Each school has many drivers and many students.

\- Every operational record (driver, student, address, booking, availability, etc.) is linked to a driving\_school\_id.

\- Superadmin is global; all other roles are scoped to a single driving\_school\_id.



Requests to the backend always operate in the context of:



\- An authenticated user.

\- The user’s driving\_school\_id (except superadmin).

\- The user’s role (SUPERADMIN, SCHOOL\_ADMIN, DRIVER, STUDENT).



The API layer enforces that context.



\## 3. Roles and permissions



There are four main roles. All permissions are ultimately enforced at the API level by inspecting the authenticated user, loading the user record, and verifying role and driving\_school\_id on every request.



\### 3.1 Superadmin



Superadmin is a global role, not tied to a single driving\_school\_id.



Capabilities:



\- Create, configure, suspend or delete driving schools.

\- Create, edit or disable school admin accounts for any school.

\- View cross-school information for support and compliance.

\- View audit logs and debug production issues across schools.



Superadmin does not normally manage individual bookings day-to-day.



\### 3.2 Driving School Admin (SCHOOL\_ADMIN)



School Admin is scoped to a single driving\_school\_id.



Within their school they can:



\- Manage drivers: create driver users, edit driver profiles, deactivate or disable drivers.

\- Manage students: create student users (e.g. invite), edit student profiles, disable or archive students.

\- Manage student addresses: create, edit, deactivate, set default pickup and drop-off addresses.

\- Manage bookings: create, modify, and cancel bookings for students in their school, subject to system rules.

\- Manage settings: define school-level policies such as minimum lead time, cancellation windows, lesson duration, working hours and allowed service radius.

\- Review and verify licence images for students and mark them as accepted, rejected or pending.



They cannot see data from other schools.



\### 3.3 Driver (DRIVER)



Driver is scoped to their own driving\_school\_id and their own instructor profile.



Capabilities:



\- Maintain their own driver profile (contact information, service centre location, working hours, radius preferences), within school policies.

\- View assigned students’ basic profile and relevant addresses as needed for routing and safety.

\- View their schedule and availability.

\- Create or update availability windows (depending on chosen policy), within school settings.

\- Accept or cancel bookings that are assigned to them, within allowed rules.



They cannot:



\- Modify student profiles or addresses.

\- Change school settings or other drivers’ data.



\### 3.4 Student / Client (STUDENT)



Student is scoped to their own driving\_school\_id and their own profile.



Capabilities:



\- Complete and maintain their own profile (name, contact information, licence details, date of birth).

\- Manage their address list (add, edit, deactivate addresses, set defaults).

\- Upload their driver’s licence image.

\- View available slots for lessons and create bookings, subject to lead-time and licence rules.

\- Cancel their own bookings within allowed cancellation windows.



They cannot access or modify other users’ data and cannot change driver or school configuration.



\## 4. Core functional areas



The final application must support at least the following areas end-to-end.



\### 4.1 Identity, auth and invitations



\- Authentication via Google Identity Platform or similar, issuing JWTs.

\- User accounts for all roles, linked to driving\_school\_id and role.

\- Invitation flows where school admin invites drivers and students, who then complete registration and profile setup.

\- **School Activation**: New schools are created with `status='suspended'` and automatically activate when a SCHOOL\_ADMIN user accepts their invitation. This ensures schools only become operational after email confirmation and admin registration completion.

\- Basic account management (password resets, account activation/deactivation).



\### 4.2 School, driver and student management



\- CRUD operations for driving schools (superadmin) including contact details and settings.

\- CRUD operations for driver profiles (school admin, driver self-service).

\- CRUD operations for student profiles (school admin, student self-service).

\- Management of student addresses, including inactive addresses and default flags.



\### 4.3 Licence handling



\- Storage of licence metadata (number, expiry date, issuing jurisdiction).

\- Storage of licence images in cloud storage, linked to student profile.

\- School admin review workflow: pending → approved or rejected.

\- Enforcement: bookings for a student can only be created if licence rules are satisfied (e.g. valid, not expired, approved by admin).



\### 4.4 Availability and booking



\- Definition of instructor working hours, service centre locations, lesson duration and buffers.

\- Creation and storage of bookings with pickup and drop-off locations, assigned driver, time and status.

\- A travel-aware availability engine that:

&nbsp; - Respects instructor working hours and daily caps.

&nbsp; - Enforces buffer times between lessons.

&nbsp; - Ensures each booking is within service radius and travel limits.

&nbsp; - Uses mapping/travel APIs to estimate travel time and distance between locations.

&nbsp; - Returns only feasible 15-minute time slots given existing bookings.



\- School-level policies such as:

&nbsp; - Minimum lead time before a booking can be made.

&nbsp; - Cancellation window rules.

&nbsp; - Optional daily travel caps per instructor.



\### 4.5 Notifications (future)



\- Email and possibly SMS notifications for:

&nbsp; - Invitations.

&nbsp; - Booking confirmation, changes and cancellations.

&nbsp; - Reminders before lessons.



Implementation details (SendGrid, Twilio, etc.) can be chosen later; the system just needs hooks for this.



\## 5. Non-functional requirements



\- Multi-tenancy: strict isolation between schools at data and API level.

\- Security: JWT-based auth, role checks, school scoping, secure storage of secrets.

\- Observability: structured logging, basic metrics, health endpoints.

\- Performance: availability engine should respond with feasible slots in an acceptable time for the typical number of bookings per day per instructor.

\- Deployability: infrastructure described as code, deployable via CI/CD into dev, staging, and prod environments on GCP.



