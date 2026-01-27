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
**Status:** ⬜ Not Started

### Description
Send email reminders to students and drivers 24 hours before scheduled lessons.

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/email.ts` | Modify | Add `sendLessonReminderEmail()` function |
| `backend/src/services/reminderScheduler.ts` | Create | Job to find and send reminders |
| `backend/src/repositories/bookings.ts` | Modify | Add `getBookingsForReminder()` query |
| `db/migrations/0013_add_reminder_sent_flag.sql` | Create | Track which reminders sent |
| `backend/src/index.ts` | Modify | Schedule the reminder job |

### Implementation Steps

#### Step 2.1: Add Database Column
```sql
-- db/migrations/0013_add_reminder_sent_flag.sql
ALTER TABLE bookings ADD COLUMN reminder_sent_at TIMESTAMP;
CREATE INDEX idx_bookings_reminder ON bookings(start_time, reminder_sent_at) 
  WHERE status = 'scheduled' AND reminder_sent_at IS NULL;
```

#### Step 2.2: Add Query Function
```typescript
// Find bookings starting in 24-25 hours that haven't had reminder sent
async function getBookingsForReminder(): Promise<Booking[]>
```

#### Step 2.3: Create Reminder Email Template
```typescript
sendLessonReminderEmail({
  to: string,
  studentName: string,
  driverName: string,
  lessonDate: string,
  lessonTime: string,
  pickupAddress: string,
  schoolName: string,
})
```

#### Step 2.4: Create Scheduler
- Run every 15 minutes via `setInterval` or external cron
- Find upcoming bookings (24 hours ahead)
- Send reminder to student
- Send reminder to driver
- Mark `reminder_sent_at` timestamp

### Acceptance Criteria
- [ ] Reminders sent ~24 hours before lesson
- [ ] Both student and driver receive reminders
- [ ] Reminders not sent for cancelled bookings
- [ ] Each booking only gets one reminder
- [ ] Email includes lesson details and pickup address
- [ ] Include "Remember to bring your physical licence" for students

---

## Task 3: Mobile Responsiveness Audit 📱

**Priority:** 🟢 LOW  
**Estimated Time:** 1-2 hours  
**Status:** ⬜ Not Started

### Description
Audit and fix any mobile layout issues across all pages.

### Pages to Review

| Page | Priority |
|------|----------|
| `/login` | High |
| `/register` | High |
| `/student` | High |
| `/driver` | Medium |
| `/admin` | Medium |
| `/` (Overview) | Medium |
| `/bookings` | Low |
| `/superadmin` | Low |

### Key Areas to Check
- [ ] Tab navigation overflow on small screens
- [ ] Form inputs properly sized
- [ ] Maps responsive on mobile
- [ ] Cards stack properly on narrow screens
- [ ] Buttons are touch-friendly (min 44px)
- [ ] Text is readable without zooming

### Implementation Steps
1. Test each page at 375px width (iPhone)
2. Fix any overflow/layout issues
3. Ensure touch targets are large enough
4. Test tab navigation usability

---

## Task 4: Error Handling Improvements 🛡️

**Priority:** 🟢 LOW  
**Estimated Time:** 1-2 hours  
**Status:** ⬜ Not Started

### Description
Improve user-facing error messages and add graceful error states.

### Components to Create/Modify

| Component | Action | Description |
|-----------|--------|-------------|
| `frontend/src/app/components/ErrorBoundary.tsx` | Create | Catch React errors |
| `frontend/src/app/components/ErrorMessage.tsx` | Create | Reusable error display |
| `frontend/src/app/components/EmptyState.tsx` | Create | Empty data states |

### Error Scenarios to Handle
- [ ] Network connectivity issues
- [ ] 401 Unauthorized (session expired)
- [ ] 403 Forbidden (permission denied)
- [ ] 404 Not Found
- [ ] 500 Server Error
- [ ] Form validation errors

### Implementation Steps
1. Create ErrorBoundary component for React errors
2. Create ErrorMessage component for API errors
3. Add consistent error handling to all API calls
4. Add empty states for lists with no data

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
| 2 | [Task 2] Lesson Reminder Emails | 🟡 MEDIUM | ⬜ Not Started |
| 3 | [Task 3] Mobile Responsiveness Audit | 🟢 LOW | ⬜ Not Started |
| 4 | [Task 4] Error Handling Improvements | 🟢 LOW | ⬜ Not Started |
| 5 | [Task 5] Loading State Improvements | 🟢 LOW | ⬜ Not Started |
| 6 | [Task 6] SMS Notifications | 🔵 OPTIONAL | ⬜ Not Started |
| 7 | [Task 7] API Documentation | 🔵 OPTIONAL | ⬜ Not Started |

**Total Estimated Time:** 6-8 hours remaining (required) + 5-7 hours (optional)

---

## ✅ Completion Checklist

### Required Tasks
- [x] Task 1: Password Reset Flow ✅
- [ ] Task 2: Lesson Reminder Emails
- [ ] Task 3: Mobile Responsiveness Audit
- [ ] Task 4: Error Handling Improvements
- [ ] Task 5: Loading State Improvements

### Optional Tasks
- [ ] Task 6: SMS Notifications
- [ ] Task 7: API Documentation

---

## 🚀 Next Steps

**Task 1 is complete!** The next task is **Task 2: Lesson Reminder Emails**.

**Command to continue:** Tell me "Let's start Task 2" and I'll begin implementation.

