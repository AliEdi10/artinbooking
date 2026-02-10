# Changelog

All notable changes to the artinbk platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **School Activation Workflow**: Schools now create with `status='suspended'` and only activate when a SCHOOL_ADMIN role accepts the invitation and completes registration
  - Added `activateDrivingSchool()` function in `backend/src/repositories/drivingSchools.ts`
  - Invitation acceptance endpoint now activates schools automatically when SCHOOL_ADMIN accepts
  - Prevents schools from becoming active before admin confirms email and completes setup

- **Superadmin School Management**: Edit, suspend, activate, and delete schools from the dashboard
  - `PATCH /schools/:schoolId` — Edit school name and contact email
  - `PATCH /schools/:schoolId/status` — Change status (active/suspended/deleted)
  - Frontend modals with confirmation dialogs for destructive actions
  - Suspended schools show yellow badge, deleted show red

- **Atomic Booking Creation**: Booking creation now uses database transactions with row-level locking
  - New `createBookingAtomic()` with `FOR UPDATE` prevents double bookings from concurrent requests
  - New `withTransaction()` helper in `db.ts` for reusable transaction support

- **Batch Address Loading**: `getAddressesByIds()` replaces N+1 individual queries
  - `buildDriverDayBookings()` now loads all addresses in a single query

- **School Status Validation**: Non-SUPERADMIN users are blocked from operating on suspended/deleted schools
  - `resolveSchoolContext()` now checks school status on every school-scoped endpoint

- **Settings Validation**: `PUT /schools/:schoolId/settings` now validates numeric fields have sensible minimums

- **Rate Limiting on Slot Queries**: Applied `slotQueryLimiter` (30 req/min) to the expensive available-slots endpoint

### Changed
- **UI Text Cleanup**: Removed technical/server-side explanatory text throughout the frontend
  - Student portal now shows user-friendly descriptions instead of implementation details
  - Removed references to "lead-time, service-radius, and licence rules" from UI
  - Updated card descriptions to be more user-centric: "Your pickup and dropoff locations" instead of "Select pickup/dropoff locations that will be validated against the service radius"
  - Simplified booking descriptions: "View and manage your scheduled lessons" instead of "Reschedule or cancel lessons; policies are enforced server-side"

- **Text Color Readability Improvements**: Enhanced accessibility and legibility across entire frontend
  - Upgraded `text-slate-600` → `text-slate-700` (first pass)
  - Upgraded `text-slate-700` → `text-slate-800` (second pass for better contrast)
  - Upgraded `text-slate-500` → `text-slate-700` for secondary text
  - Affected 16+ component and page files across the frontend
  - Improves WCAG accessibility compliance

### Fixed
- **User Role Overwrite on Multi-School Invitation**: `createUserWithIdentity()` now checks if user already belongs to another school before overwriting
- **Student/Driver Profile Creation**: Registration now fails properly if profile creation fails, instead of silently creating a broken account
- **Browser Base64 Decoding**: `tokenUtils.ts` now uses `atob()` in browser environments instead of Node.js `Buffer`
- **Unsafe Array Access**: Frontend address fallbacks now check array length before indexing
- **Migration Default Mismatch**: New migration `0015` changes school default status from 'active' to 'suspended'
- **AGENTS.md**: Fixed reference to non-existent `docs/CURRENT_STATUS.md`
- **Password Reset Documentation**: Updated README to mark password reset as implemented

- **Express Rate Limiting with Railway Proxy**: Fixed `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` error
  - Added `app.set('trust proxy', 1)` in `backend/src/app.ts` to trust Railway's reverse proxy
  - Allows express-rate-limit to properly read X-Forwarded-For headers
  - Prevents validation errors when deployed behind Railway's proxy
  - Commit: `2de422a`

- **School Status Display Bug**: Fixed type mismatch causing schools to show as "Inactive"
  - Updated frontend DrivingSchool type from `active: boolean` to `status: 'active' | 'suspended' | 'deleted'`
  - Fixed in `frontend/src/app/superadmin/page.tsx` (superadmin dashboard)
  - Fixed in `frontend/src/app/page.tsx` (homepage active school count)
  - Updated status badge logic to display all three statuses correctly
  - Commits: `dc9d8c3`, `7620137`

## Previous Work (Pre-Changelog)

### Completed Features
- 8 booking workflow improvements (committed in previous sessions)
- CORS configuration for multi-origin deployment
- Rate limiting middleware with configurable limits
- Database schema with PostgreSQL enum types for DrivingSchoolStatus
- Invitation-based user registration workflow
- Multi-tenant architecture with role-based access control
- JWT authentication with Google Identity Platform integration
- Student licence management with admin review workflow
- Travel-aware availability engine
- Address management with geocoding support

---

## Notes for Future Maintainers

### Recent Changes Summary (2026-02-09)

1. **School Lifecycle Management**
   - Schools now start as "suspended" upon creation
   - Only become "active" after admin accepts invitation email
   - This prevents premature activation before email confirmation

2. **Frontend Type Alignment**
   - Driving school status field changed from boolean to enum
   - Frontend now properly aligned with backend schema
   - Type: `status: 'active' | 'suspended' | 'deleted'`

3. **Railway Deployment**
   - Backend configured to work with Railway's reverse proxy
   - Trust proxy setting enables proper client IP detection
   - Essential for rate limiting and security features

4. **UI/UX Improvements**
   - Removed technical jargon from user-facing text
   - Improved text contrast throughout the application
   - Better accessibility for users with visual impairments

### Key Files Modified

**Backend:**
- `backend/src/app.ts` - School status validation, atomic bookings, settings validation, school management endpoints, rate limiter, N+1 fix
- `backend/src/db.ts` - Added `withTransaction()` helper
- `backend/src/repositories/drivingSchools.ts` - School CRUD: create, activate, update, update status
- `backend/src/repositories/bookings.ts` - Added `createBookingAtomic()` with overlap check
- `backend/src/repositories/studentAddresses.ts` - Added `getAddressesByIds()` batch loader
- `backend/src/repositories/users.ts` - Multi-school protection on user creation

**Frontend:**
- `frontend/src/app/superadmin/page.tsx` - Full school management (edit/suspend/delete modals)
- `frontend/src/app/student/page.tsx` - UI text cleanup, color improvements, safe array access
- `frontend/src/app/bookings/page.tsx` - Safe array access fix
- `frontend/src/app/auth/tokenUtils.ts` - Browser-safe base64 decoding
- `frontend/src/app/admin/page.tsx` - Color improvements
- `frontend/src/app/driver/page.tsx` - Color improvements
- `frontend/src/app/page.tsx` - Type fixes, active school filter

**Migrations:**
- `db/migrations/0015_fix_school_default_status.sql` - Fix default status to 'suspended'

### Testing Checklist for These Changes

- [ ] Verify schools create with status='suspended'
- [ ] Verify schools activate when SCHOOL_ADMIN accepts invitation
- [ ] Test rate limiting works correctly on Railway
- [ ] Verify superadmin dashboard shows correct school statuses
- [ ] Verify homepage shows correct active school count
- [ ] Test all UI text is readable (no grey-on-white issues)
- [ ] Verify no technical jargon appears in student portal

