# Artinbk API Documentation

REST API for the Artinbk driving school booking platform.

## Base URL

- **Development:** `http://localhost:3001`
- **Production:** `https://your-production-url.railway.app`

## Authentication

All endpoints (except public auth endpoints) require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### User Roles

| Role | Description |
|------|-------------|
| `SUPERADMIN` | Full access to all schools and system settings |
| `SCHOOL_ADMIN` | Full access to their school's data |
| `DRIVER` | Access to their schedule and assigned students |
| `STUDENT` | Access to their profile and bookings |

---

## Endpoints

### Health Check

#### `GET /health`
Returns server health status.

**Response:** `200 OK` - "OK"

---

### Authentication

#### `POST /auth/register`
Register a new student account.

**Request Body:**
```json
{
  "email": "student@example.com",
  "password": "securepassword",
  "role": "STUDENT",
  "drivingSchoolId": 1,
  "fullName": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "role": "STUDENT",
    "drivingSchoolId": 1
  }
}
```

---

#### `POST /auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

---

#### `POST /auth/forgot-password`
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "If an account exists with this email, you will receive a password reset link."
}
```

---

#### `POST /auth/reset-password`
Reset password with token.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "password": "newpassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password has been reset successfully."
}
```

---

### Schools

#### `GET /schools`
List driving schools. Superadmins see all schools, others see only their school.

**Auth Required:** Yes

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Artin Driving School",
    "contactEmail": "contact@artindrivingschool.com"
  }
]
```

---

#### `POST /schools`
Create a new driving school (Superadmin only).

**Auth Required:** Yes (SUPERADMIN)

**Request Body:**
```json
{
  "name": "New Driving School",
  "contactEmail": "contact@example.com"
}
```

---

### Drivers

#### `GET /schools/:schoolId/drivers`
List drivers for a school.

**Auth Required:** Yes

---

#### `POST /schools/:schoolId/drivers`
Create a driver profile.

**Auth Required:** Yes (SCHOOL_ADMIN)

**Request Body:**
```json
{
  "userId": 5,
  "fullName": "John Driver",
  "phoneNumber": "+1234567890"
}
```

---

#### `PATCH /schools/:schoolId/drivers/:driverId`
Update driver profile.

**Auth Required:** Yes

**Request Body:**
```json
{
  "fullName": "Updated Name",
  "phoneNumber": "+1234567890",
  "active": true,
  "serviceCenterLatitude": 43.6532,
  "serviceCenterLongitude": -79.3832
}
```

---

### Students

#### `GET /schools/:schoolId/students`
List students for a school.

**Auth Required:** Yes

---

#### `POST /schools/:schoolId/students`
Create a student profile.

**Auth Required:** Yes (SCHOOL_ADMIN)

---

#### `PATCH /schools/:schoolId/students/:studentId`
Update student profile.

**Auth Required:** Yes

**Request Body:**
```json
{
  "fullName": "Updated Name",
  "phoneNumber": "+1234567890",
  "licenceStatus": "approved",
  "licenceNumber": "ABC123",
  "licenceExpiryDate": "2025-12-31",
  "allowedHours": 20,
  "maxLessonsPerDay": 2
}
```

---

#### `GET /schools/:schoolId/students/:studentId/usage`
Get student usage statistics.

**Auth Required:** Yes

**Response:** `200 OK`
```json
{
  "usedHours": 5.5,
  "allowedHours": 20,
  "todayBookings": 1,
  "maxLessonsPerDay": 2
}
```

---

### Student Addresses

#### `GET /schools/:schoolId/students/:studentId/addresses`
List addresses for a student.

**Auth Required:** Yes

---

#### `POST /schools/:schoolId/students/:studentId/addresses`
Add an address for a student.

**Auth Required:** Yes

**Request Body:**
```json
{
  "label": "Home",
  "line1": "123 Main Street",
  "city": "Toronto",
  "provinceOrState": "ON",
  "latitude": 43.6532,
  "longitude": -79.3832,
  "isDefaultPickup": true,
  "isDefaultDropoff": false
}
```

---

### Driver Availability

#### `GET /schools/:schoolId/drivers/:driverId/availability`
List availability for a driver.

**Auth Required:** Yes

---

#### `POST /schools/:schoolId/drivers/:driverId/availability`
Add availability for a driver.

**Auth Required:** Yes

**Request Body:**
```json
{
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "effectiveFrom": "2024-01-01",
  "effectiveUntil": "2024-12-31"
}
```

*Note: dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday*

---

#### `DELETE /schools/:schoolId/drivers/:driverId/availability/:availabilityId`
Delete an availability slot.

**Auth Required:** Yes

---

#### `GET /schools/:schoolId/drivers/:driverId/available-slots`
Get available booking slots for a driver on a specific date.

**Auth Required:** Yes

**Query Parameters:**
- `date` (required) - Date in YYYY-MM-DD format
- `pickupAddressId` (required) - Student's pickup address ID
- `dropoffAddressId` (required) - Student's dropoff address ID

**Response:** `200 OK`
```json
[
  "2024-01-15T09:00:00.000Z",
  "2024-01-15T10:30:00.000Z",
  "2024-01-15T14:00:00.000Z"
]
```

---

### Bookings

#### `GET /schools/:schoolId/bookings`
List bookings for a school.

**Auth Required:** Yes

**Query Parameters:**
- `status` - Filter by status: `upcoming`, `past`, `all`
- `driverId` - Filter by driver
- `studentId` - Filter by student

---

#### `POST /schools/:schoolId/bookings`
Create a new booking.

**Auth Required:** Yes

**Request Body:**
```json
{
  "driverId": 1,
  "studentId": 2,
  "pickupAddressId": 3,
  "dropoffAddressId": 4,
  "startTime": "2024-01-15T09:00:00.000Z"
}
```

---

#### `GET /schools/:schoolId/bookings/:bookingId`
Get booking details.

**Auth Required:** Yes

---

#### `PATCH /schools/:schoolId/bookings/:bookingId`
Update a booking.

**Auth Required:** Yes

**Request Body:**
```json
{
  "startTime": "2024-01-15T10:00:00.000Z",
  "driverId": 2
}
```

---

#### `POST /schools/:schoolId/bookings/:bookingId/cancel`
Cancel a booking.

**Auth Required:** Yes

**Request Body:**
```json
{
  "reasonCode": "student_request"
}
```

---

### School Settings

#### `GET /schools/:schoolId/settings`
Get school settings.

**Auth Required:** Yes

**Response:** `200 OK`
```json
{
  "id": 1,
  "minBookingLeadTimeHours": 24,
  "cancellationCutoffHours": 24,
  "defaultLessonDurationMinutes": 90,
  "defaultBufferMinutesBetweenLessons": 30,
  "defaultServiceRadiusKm": "50",
  "dailyBookingCapPerDriver": 6,
  "allowStudentToPickDriver": true,
  "allowDriverSelfAvailabilityEdit": true
}
```

---

#### `PUT /schools/:schoolId/settings`
Update school settings.

**Auth Required:** Yes (SCHOOL_ADMIN)

---

### Invitations

#### `POST /schools/:schoolId/invitations`
Create an invitation for a driver or student.

**Auth Required:** Yes (SCHOOL_ADMIN)

**Request Body:**
```json
{
  "email": "newstudent@example.com",
  "role": "STUDENT",
  "fullName": "New Student Name",
  "allowedHours": 20,
  "maxLessonsPerDay": 2
}
```

---

#### `GET /schools/:schoolId/invitations/pending`
List pending invitations.

**Auth Required:** Yes (SCHOOL_ADMIN)

---

#### `POST /schools/:schoolId/invitations/:invitationId/resend`
Resend invitation email.

**Auth Required:** Yes (SCHOOL_ADMIN)

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Created successfully |
| `400` | Bad request (invalid input) |
| `401` | Unauthorized (missing or invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Resource not found |
| `500` | Internal server error |

---

## Additional Endpoints (not in original spec)

The following endpoints were added after the initial API documentation:

### School Management

#### `PATCH /schools/:schoolId`
Update school name/contact email. **Auth:** SUPERADMIN only.

#### `PATCH /schools/:schoolId/status`
Change school status (active, suspended, deleted). **Auth:** SUPERADMIN only.

**Request Body:**
```json
{ "status": "active" }
```

---

### Invitation Management

#### `GET /invitations/validate?token=<token>`
Validate an invitation token (public, no auth). Returns email, role, school name, expiry.

#### `POST /invitations/accept`
Accept an invitation and create an account. Supports password or Bearer token (identity provider) flow.

**Request Body:**
```json
{
  "token": "invitation_token",
  "password": "newpassword123",
  "fullName": "Student Name",
  "phone": "+1234567890",
  "isMinor": false
}
```

#### `DELETE /schools/:schoolId/invitations/:invitationId`
Cancel/delete a pending invitation. **Auth:** SCHOOL_ADMIN.

---

### Address Management

#### `PATCH /schools/:schoolId/addresses/:addressId`
Update an existing address. **Auth:** SCHOOL_ADMIN, STUDENT (own only).

#### `GET /schools/:schoolId/addresses/batch?studentIds=1,2,3`
Batch-fetch addresses for multiple students. Max 200 IDs. **Auth:** SCHOOL_ADMIN, DRIVER.

---

### Booking Lifecycle

#### `POST /schools/:schoolId/bookings/:bookingId/complete`
Mark a booking as completed. **Auth:** SCHOOL_ADMIN, DRIVER (own bookings only).

---

### Reschedule (via PATCH booking)

When `PATCH /schools/:schoolId/bookings/:bookingId` includes a `startTime`, it triggers the reschedule flow:
- Validates the new slot against the availability engine
- For students: rejects if slot is unavailable
- For admins/drivers: returns `{ code: "REQUIRES_FORCE" }` if slot is outside availability; resend with `{ force: true }` to override
- Uses atomic reschedule with overlap check

---

### Driver Holidays

#### `GET /schools/:schoolId/drivers/holidays`
List all driver holidays/time-off for a school. **Auth:** SCHOOL_ADMIN.

---

### System

#### `GET /system/status`
Server status: uptime, DB latency, memory, pool stats. **Auth:** SUPERADMIN.

---

### Analytics & Audit Logs

#### `GET /schools/:schoolId/analytics/dashboard`
Dashboard stats (booking counts, revenue, popular times). **Auth:** SCHOOL_ADMIN, DRIVER.

#### `GET /schools/:schoolId/analytics/audit-log`
Paginated audit log. Query params: `limit` (max 200), `offset`. **Auth:** SCHOOL_ADMIN.

---

## OpenAPI Specification

For the full OpenAPI 3.0 specification, see [openapi.yaml](./openapi.yaml).

You can view this in Swagger UI by loading the YAML file.
