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
**Status:** ⬜ Not Started

### Description
Add skeleton loaders and better loading states for improved UX.

### Components to Create

| Component | Description |
|-----------|-------------|
| `frontend/src/app/components/Skeleton.tsx` | Basic skeleton loader |
| `frontend/src/app/components/CardSkeleton.tsx` | SummaryCard loading state |
| `frontend/src/app/components/TableSkeleton.tsx` | Table loading state |

### Pages to Add Loading States
- [ ] Overview page (role-specific cards)
- [ ] Admin dashboard (roster, bookings)
- [ ] Driver page (schedule, availability)
- [ ] Student page (profile, addresses, bookings)

---

## Task 6: SMS Notifications (Optional) 📱

**Priority:** 🔵 OPTIONAL  
**Estimated Time:** 3-4 hours  
**Status:** ⬜ Not Started

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
**Status:** ⬜ Not Started

### Description
Add OpenAPI/Swagger documentation for API endpoints.

### Files to Create
- `backend/src/swagger.ts` - Swagger configuration
- `backend/docs/openapi.yaml` - API specification

### Endpoints to Document
- Authentication (`/auth/*`)
- Schools (`/schools/*`)
- Users, Drivers, Students
- Bookings
- Availability
- Addresses

---

## 📊 Implementation Order

| Order | Task | Priority | Status |
|-------|------|----------|--------|
| 1 | [Task 1] Password Reset Flow | 🟡 HIGH | ✅ Complete |
| 2 | [Task 2] Lesson Reminder Emails | 🟡 MEDIUM | ✅ Complete |
| 3 | [Task 3] Mobile Responsiveness Audit | 🟢 LOW | ✅ Complete |
| 4 | [Task 4] Error Handling Improvements | 🟢 LOW | ✅ Complete |
| 5 | [Task 5] Loading State Improvements | 🟢 LOW | ⬜ Not Started |
| 6 | [Task 6] SMS Notifications | 🔵 OPTIONAL | ⬜ Not Started |
| 7 | [Task 7] API Documentation | 🔵 OPTIONAL | ⬜ Not Started |

**Total Estimated Time:** 1-2 hours remaining (required) + 5-7 hours (optional)

---

## ✅ Completion Checklist

### Required Tasks
- [x] Task 1: Password Reset Flow ✅
- [x] Task 2: Lesson Reminder Emails ✅
- [x] Task 3: Mobile Responsiveness Audit ✅
- [x] Task 4: Error Handling Improvements ✅
- [ ] Task 5: Loading State Improvements

### Optional Tasks
- [ ] Task 6: SMS Notifications
- [ ] Task 7: API Documentation

---

## 🚀 Next Steps

**Tasks 1, 2, 3 & 4 are complete!** The next task is **Task 5: Loading State Improvements**.

**Command to continue:** Tell me "Let's start Task 5" and I'll begin implementation.
