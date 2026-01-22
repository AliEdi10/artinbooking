# Architecture Overview

**Updated: January 2026**

## Production Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | https://artinbooking.vercel.app |
| Backend | Railway | (auto-assigned) |
| Database | Railway PostgreSQL | (internal) |
| Email | Resend API | (service) |

## Repository Structure

```
artinbk-main/
├── backend/src/
│   ├── app.ts              # Express routes (1600+ lines)
│   ├── models.ts           # TypeScript types & mappers
│   ├── middleware/         # Auth & authorization
│   ├── repositories/       # Database access layer
│   └── services/
│       ├── email.ts        # Resend email (booking confirm, cancel)
│       └── availability.ts # Travel-aware slot engine
├── frontend/src/app/
│   ├── admin/page.tsx      # Full admin dashboard
│   ├── driver/page.tsx     # Driver portal with student viewer
│   ├── student/page.tsx    # Student booking portal
│   ├── register/page.tsx   # Registration with guardian fields
│   ├── components/         # Reusable UI (MapPicker, Calendar, etc)
│   └── auth/               # AuthProvider, Protected routes
├── db/migrations/          # 11 SQL migrations
└── docs/                   # Legacy design docs (outdated)
```

## Backend Architecture

- **Express 5** with TypeScript
- **JWT Authentication** (local password + Google Identity)
- **Multi-tenant** - all data scoped by `driving_school_id`
- **Role-based access** - SUPERADMIN, SCHOOL_ADMIN, DRIVER, STUDENT

### Key Services

| Service | Purpose |
|---------|---------|
| `availability.ts` | Travel-aware slot computation with Google Maps |
| `email.ts` | Resend integration for booking notifications |
| `travelProvider.ts` | Google Maps distance/time API |

## Frontend Architecture

- **Next.js 16** with App Router
- **TailwindCSS** for styling
- **Google Maps** integration (MapPicker, MapViewer components)
- **Role-protected routes** via AuthProvider

### Pages & Features

| Page | Features |
|------|----------|
| `/admin` | Driver/student management, invitations, settings, licence review |
| `/driver` | Availability, service center, working hours, student profile viewer |
| `/student` | Profile, addresses, licence upload, booking flow |
| `/register` | Phone (required), age selection, guardian info for minors |

## Database Schema

11 migrations covering:
- Users & authentication
- Driving schools (multi-tenant)
- Driver profiles (service center, radius, working hours)
- Student profiles (phone, isMinor, guardian info)
- Addresses with GPS coordinates
- Bookings with status tracking
- Availability slots & holidays
- School settings (caps, policies)

## Email Notifications

Via **Resend API**:
- ✅ Booking confirmation (with physical license reminder!)
- ✅ Booking cancellation
- ✅ Driver notification on new booking
- ✅ Invitation emails

## What's NOT Implemented

- SMS notifications
- Password reset flow
- E2E test automation
- GCP deployment (using Vercel/Railway instead)
