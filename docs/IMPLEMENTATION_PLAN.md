# 📋 artinbk Implementation Plan

**Created:** January 27, 2026  
**Status:** Planning Phase  
**Goal:** Finalize remaining features to complete the platform

---

## 🎯 Overview

This document outlines the remaining features to implement for artinbk. Tasks are organized by priority and include detailed implementation steps.

---

## Task 1: Password Reset Flow 🔐

**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours  
**Status:** ✅ COMPLETED (January 27, 2026)

### Description
Allow users to reset their password if they forget it. The email infrastructure already exists (Resend API).

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `backend/src/routes/auth.ts` | Modified | Added `/forgot-password` and `/reset-password` endpoints |
| `backend/src/repositories/passwordResetTokens.ts` | Created | Password reset token functions |
| `backend/src/services/email.ts` | ✅ Existed | `sendPasswordResetEmail()` already implemented |
| `db/migrations/0012_add_password_reset_tokens.sql` | Created | Store reset tokens with expiry |
| `frontend/src/app/login/forgot-password/page.tsx` | Created | Forgot password form UI |
| `frontend/src/app/reset-password/page.tsx` | Created | Reset password form UI with strength indicators |
| `frontend/src/app/login/page.tsx` | Modified | Added "Forgot Password?" link |

### Acceptance Criteria
- [x] User can request password reset via email
- [x] Reset email contains valid link with token
- [x] Token expires after 1 hour
- [x] Token is single-use only
- [x] Password is properly hashed before storage
- [x] User gets success/error feedback

---

## Task 2: Lesson Reminder Emails 📧

**Priority:** 🟡 MEDIUM  
**Estimated Time:** 2-3 hours  
**Status:** ✅ COMPLETED (January 27, 2026)

### Description
Send email reminders to students and drivers 24 hours before scheduled lessons.

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/email.ts` | Modified | Added `sendStudentLessonReminderEmail()` and `sendDriverLessonReminderEmail()` |
| `backend/src/services/reminderScheduler.ts` | Created | Scheduler job that runs every 15 minutes |
| `backend/src/repositories/bookings.ts` | Modified | Added `getBookingsForReminder()` and `markReminderSent()` |
| `backend/src/models.ts` | Modified | Added `reminderSentAt` field to Booking interface |
| `db/migrations/0013_add_reminder_sent_flag.sql` | Created | Added `reminder_sent_at` column with partial index |
| `backend/src/index.ts` | Modified | Starts scheduler in production or when enabled |

### Configuration
The scheduler is controlled by environment variables:
- **Production**: Automatically enabled when `NODE_ENV=production`  
- **Development**: Set `ENABLE_REMINDER_SCHEDULER=true` to enable

### Acceptance Criteria
- [x] Reminders sent ~24 hours before lesson (23-25 hour window)
- [x] Both student and driver receive reminders
- [x] Reminders not sent for cancelled bookings (only 'scheduled' status)
- [x] Each booking only gets one reminder (tracked via `reminder_sent_at`)
- [x] Email includes lesson details and pickup address
- [x] Include "Remember to bring your physical licence" for students

---

## Task 3: Mobile Responsiveness Audit 📱

**Priority:** 🟢 LOW  
**Estimated Time:** 1-2 hours  
**Status:** ✅ COMPLETED (January 27, 2026)

### Description
Audit and fix any mobile layout issues across all pages.

### Files Modified

| File | Changes |
|------|---------|
| `frontend/src/app/components/AppShell.tsx` | Made navigation horizontally scrollable, improved header layout for mobile |
| `frontend/src/app/login/page.tsx` | Responsive grid for dev users, touch-friendly button heights |
| `frontend/src/app/register/page.tsx` | Responsive grids, wrapping elements, touch-friendly buttons |
| `frontend/src/app/student/page.tsx` | Responsive grids for booking limits, licence form, slot picker |
| `frontend/src/app/driver/page.tsx` | Scrollable tab navigation with touch-friendly sizing |
| `frontend/src/app/admin/page.tsx` | Responsive grids for modal, forms, settings; stacking action buttons |

### Key Areas Fixed
- [x] Tab navigation overflow on small screens (horizontal scroll)
- [x] Form inputs properly sized
- [x] Cards stack properly on narrow screens (grid-cols-1 sm:grid-cols-2)
- [x] Buttons are touch-friendly (min-h-[44px] or min-h-[48px])
- [x] Text is readable without zooming
- [x] Action buttons stack vertically on mobile

---


## Task 4: Error Handling Improvements 🛡️

**Priority:** 🟢 LOW  
**Estimated Time:** 1-2 hours  
**Status:** ✅ COMPLETED (January 27, 2026)

### Description
Improve user-facing error messages and add graceful error states.

### Files Created/Modified

| File | Description |
|------|-------------|
| `frontend/src/app/apiClient.ts` | Enhanced with ApiError class, proper status code handling, user-friendly messages |
| `frontend/src/app/components/ErrorBoundary.tsx` | React error boundary for catching component crashes |
| `frontend/src/app/components/ErrorMessage.tsx` | Reusable error display with different types (network, unauthorized, etc.) |
| `frontend/src/app/components/EmptyState.tsx` | Empty state component with presets for common scenarios |

### Error Scenarios Handled
- [x] Network connectivity issues (status 0)
- [x] 401 Unauthorized (session expired)
- [x] 403 Forbidden (permission denied)
- [x] 404 Not Found
- [x] 500/502/503/504 Server Errors
- [x] 400/422 Validation errors
- [x] React component crashes (ErrorBoundary)

### Key Features
- **ApiError class** with helper methods (isAuthError, isNetworkError, etc.)
- **User-friendly error messages** for all HTTP status codes
- **ErrorBoundary** component for graceful React error recovery
- **ErrorMessage** component with color-coded types and action buttons
- **EmptyState** component with presets for bookings, students, drivers, addresses

---


## Task 5: Loading State Improvements ⏳

**Priority:** 🟢 LOW  
**Estimated Time:** 1-2 hours  
**Status:** ✅ COMPLETED (January 27, 2026)

### Description
Add skeleton loaders and better loading states for improved UX.

### Files Created/Modified

| File | Description |
|------|-------------|
| `frontend/src/app/components/Skeleton.tsx` | Base skeleton with variants (text, avatar, button, input, badge) |
| `frontend/src/app/components/CardSkeleton.tsx` | Card skeletons (booking list, profile, addresses, slots, stats, calendar) |
| `frontend/src/app/components/TableSkeleton.tsx` | Table and list skeletons (table, list, card grid) |
| `frontend/src/app/components/LoadingSpinner.tsx` | Enhanced with additional variants (page, card, inline, full-page) |

### Components Created
- **Skeleton.tsx**: Base component with shimmer animation
  - `Skeleton` - configurable size, rounded corners
  - `SkeletonText` - multi-line text placeholder
  - `SkeletonAvatar` - circular avatar placeholder
  - `SkeletonButton` - button placeholder
  - `SkeletonInput` - input field placeholder
  - `SkeletonBadge` - badge placeholder

- **CardSkeleton.tsx**: Card-specific skeletons
  - `CardSkeleton` - SummaryCard placeholder
  - `BookingListSkeleton` - booking items
  - `ProfileSkeleton` - user profiles
  - `AddressListSkeleton` - address items
  - `SlotListSkeleton` - time slots
  - `StatsGridSkeleton` - statistics grid
  - `CalendarSkeleton` - calendar view

- **TableSkeleton.tsx**: Table/list skeletons
  - `TableSkeleton` - tabular data
  - `ListSkeleton` - simple lists
  - `CardGridSkeleton` - card grid

- **LoadingSpinner.tsx**: Spinner variants
  - `LoadingSpinner` - basic spinner (sm/md/lg/xl)
  - `LoadingOverlay` - overlay with spinner
  - `FullPageLoading` - full-page loading
  - `LoadingInline` - inline loading
  - `LoadingCard` - card-style loading
  - `PageLoading` - page-level loading

---


## Task 6: SMS Notifications (Optional) 📱

**Priority:** 🔵 OPTIONAL  
**Estimated Time:** 3-4 hours  
**Status:** ⏭️ SKIPPED (User decided not to implement SMS for now)


### Description
Send SMS notifications via Twilio for critical events.

### Prerequisites
- Twilio account
- Verified phone numbers
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER env vars

### SMS Events to Implement
- Booking confirmation
- Booking cancellation
- Lesson reminder (24 hours before)
- Lesson reminder (1 hour before)

### Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/services/sms.ts` | Create |
| `backend/src/app.ts` | Modify (call SMS on booking events) |
| `.env` | Add Twilio credentials |

---

## Task 7: API Documentation (Optional) 📚

**Priority:** 🔵 OPTIONAL  
**Estimated Time:** 2-3 hours  
**Status:** ✅ COMPLETED (January 27, 2026)

### Description
Add OpenAPI/Swagger documentation for API endpoints.

### Files Created

| File | Description |
|------|-------------|
| `docs/api/openapi.yaml` | Full OpenAPI 3.0 specification (~900 lines) |
| `docs/api/README.md` | Markdown API documentation with examples |

### Endpoints Documented
- **Health**: `/health`
- **Authentication**: `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`
- **Schools**: `GET /schools`, `POST /schools`
- **Drivers**: List, Create, Update driver profiles
- **Students**: List, Create, Update student profiles, Usage stats
- **Addresses**: List, Create student addresses
- **Availability**: List, Create, Delete driver availability, Available slots
- **Bookings**: List, Create, Get, Update, Cancel bookings
- **Settings**: Get, Update school settings
- **Invitations**: Create, List pending, Resend invitations

### Schema Definitions
- Error, User, AuthResponse
- DrivingSchool, Driver, Student
- Address, Availability, Booking
- SchoolSettings, Invitation

---


## 📊 Implementation Order

| Order | Task | Priority | Status |
|-------|------|----------|--------|
| 1 | [Task 1] Password Reset Flow | 🟡 HIGH | ✅ Complete |
| 2 | [Task 2] Lesson Reminder Emails | 🟡 MEDIUM | ✅ Complete |
| 3 | [Task 3] Mobile Responsiveness Audit | 🟢 LOW | ✅ Complete |
| 4 | [Task 4] Error Handling Improvements | 🟢 LOW | ✅ Complete |
| 5 | [Task 5] Loading State Improvements | 🟢 LOW | ✅ Complete |
| 6 | [Task 6] SMS Notifications | 🔵 OPTIONAL | ⏭️ Skipped |
| 7 | [Task 7] API Documentation | 🔵 OPTIONAL | ✅ Complete |

**Total Estimated Time:** 0 hours remaining - All tasks complete! 🎉

---

## ✅ Completion Checklist

### Required Tasks
- [x] Task 1: Password Reset Flow ✅
- [x] Task 2: Lesson Reminder Emails ✅
- [x] Task 3: Mobile Responsiveness Audit ✅
- [x] Task 4: Error Handling Improvements ✅
- [x] Task 5: Loading State Improvements ✅

### Optional Tasks
- [x] Task 6: SMS Notifications ⏭️ (Skipped - not needed at this time)
- [x] Task 7: API Documentation ✅

---

## 🎉 Phase 1 Complete!

**All Phase 1 tasks completed January 27, 2026.**

---

## Phase 2: Feature Enhancements (February 25-27, 2026)

### Task 8: CSV Reports ✅
**Status:** ✅ COMPLETED (February 25, 2026)

Export students, bookings, and drivers as CSV from admin dashboard.
- `GET /schools/:schoolId/analytics/csv/students`
- `GET /schools/:schoolId/analytics/csv/bookings`
- `GET /schools/:schoolId/analytics/csv/drivers`

### Task 9: Profile Cards ✅
**Status:** ✅ COMPLETED (February 25, 2026)

- Instructor profile card visible to students (click instructor name)
- Student profile card visible to drivers (click student name)

### Task 10: Licence Download Button ✅
**Status:** ✅ COMPLETED (February 26, 2026)

Added "Open full image" link in admin licence review panel to view full licence image in new tab.

### Task 11: Configurable Reminder Timing ✅
**Status:** ✅ COMPLETED (February 26, 2026)

- Migration 0020: `reminder_hours_before` column on `school_settings`
- Admin can pick 24h/48h/72h reminder window per school
- Reminder scheduler dynamically reads per-school setting

### Task 12: Customizable Email Templates ✅
**Status:** ✅ COMPLETED (February 26, 2026)

- Migration 0021: `school_email_templates` table
- 4 template keys: booking_confirmation, booking_cancelled, lesson_reminder, invitation
- Per-school customizable subject line + plain-text custom note
- Subject supports `{varName}` interpolation
- Admin dashboard → Email Templates section with collapsible editor per template

### Task 13: PWA + Mobile Optimization ✅
**Status:** ✅ COMPLETED (February 27, 2026)

- `manifest.json` with standalone display, theme color #1e40af
- Layout metadata for PWA and Apple web app
- Responsive fixes: flex-col/sm:flex-row on form inputs, grid-cols-1/sm:grid-cols-2 on date/time grids, viewport-aware modal sizing

### Task 14: Guardian Email CC ✅
**Status:** ✅ COMPLETED (February 27, 2026)

For minor students with `guardian_email` set, automatically send copies of:
- Booking confirmation
- Booking cancellation
- Lesson reminder
Guard: `if (student.isMinor && student.guardianEmail)`. No migration needed.

---

## 📊 Full Implementation Summary

| Phase | Task | Status |
|-------|------|--------|
| 1 | Password Reset Flow | ✅ Complete |
| 1 | Lesson Reminder Emails | ✅ Complete |
| 1 | Mobile Responsiveness Audit | ✅ Complete |
| 1 | Error Handling Improvements | ✅ Complete |
| 1 | Loading State Improvements | ✅ Complete |
| 1 | SMS Notifications | ⏭️ Skipped |
| 1 | API Documentation | ✅ Complete |
| 2 | CSV Reports | ✅ Complete |
| 2 | Profile Cards | ✅ Complete |
| 2 | Licence Download Button | ✅ Complete |
| 2 | Configurable Reminder Timing | ✅ Complete |
| 2 | Customizable Email Templates | ✅ Complete |
| 2 | PWA + Mobile Optimization | ✅ Complete |
| 2 | Guardian Email CC | ✅ Complete |

**All tasks complete! The application is production-ready.**
