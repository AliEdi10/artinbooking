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
- `backend/src/app.ts` - Added trust proxy configuration
- `backend/src/repositories/drivingSchools.ts` - School creation and activation logic

**Frontend:**
- `frontend/src/app/student/page.tsx` - UI text cleanup, color improvements
- `frontend/src/app/admin/page.tsx` - Color improvements
- `frontend/src/app/driver/page.tsx` - Color improvements
- `frontend/src/app/superadmin/page.tsx` - Type fixes, color improvements
- `frontend/src/app/page.tsx` - Type fixes, active school filter
- Multiple component files - Text color readability upgrades

### Testing Checklist for These Changes

- [ ] Verify schools create with status='suspended'
- [ ] Verify schools activate when SCHOOL_ADMIN accepts invitation
- [ ] Test rate limiting works correctly on Railway
- [ ] Verify superadmin dashboard shows correct school statuses
- [ ] Verify homepage shows correct active school count
- [ ] Test all UI text is readable (no grey-on-white issues)
- [ ] Verify no technical jargon appears in student portal

