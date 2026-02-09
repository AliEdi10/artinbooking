# artinbk - Driving School Booking Platform

**Status: Production Ready (Updated February 2026)**

artinbk is a multi-tenant driving school platform deployed on:
- **Frontend**: Vercel (https://artinbooking.vercel.app)
- **Backend**: Railway (Node.js/Express)
- **Database**: Railway PostgreSQL
- **Email**: Resend API

## Current Production Status

| Feature | Status |
|---------|--------|
| Multi-tenant architecture | ✅ Complete |
| User roles (Superadmin, Admin, Driver, Student) | ✅ Complete |
| JWT authentication (Google + local password) | ✅ Complete |
| Invitation-based registration | ✅ Complete |
| Admin dashboard (full CRUD) | ✅ Complete |
| Driver portal (availability, service center, student view) | ✅ Complete |
| Student portal (profile, addresses, licence upload, booking) | ✅ Complete |
| Booking system (travel-aware, service radius) | ✅ Complete |
| Email notifications (confirmation, cancellation, driver alerts) | ✅ Complete |
| Student phone + minor/guardian support | ✅ Complete |
| Physical license reminder in emails | ✅ Complete |

## Tech Stack

- **Backend**: Express 5, TypeScript, pg, Resend (email)
- **Frontend**: Next.js 16, React, TypeScript, TailwindCSS
- **Database**: PostgreSQL with 11 migrations
- **Auth**: JWT (local password + Google Identity)
- **Maps**: Google Maps API

## Quick Start (Local Development)

```bash
# Backend
cd backend
npm install
npm run dev  # http://localhost:3001

# Frontend  
cd frontend
npm install
npm run dev  # http://localhost:3000
```

## File Structure

```
artinbk-main/
├── backend/
│   └── src/
│       ├── app.ts           # Express routes
│       ├── models.ts        # TypeScript types
│       ├── repositories/    # Database access
│       └── services/        # Business logic (email, availability)
├── frontend/
│   └── src/app/
│       ├── admin/page.tsx   # Admin portal
│       ├── driver/page.tsx  # Driver portal
│       ├── student/page.tsx # Student portal
│       ├── register/page.tsx # Registration with guardian fields
│       └── login/page.tsx   # Login
├── db/
│   └── migrations/          # SQL migrations (0001-0011)
└── docs/                    # Legacy design docs
```

## Environment Variables

### Backend (Railway)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
FRONTEND_URL=https://artinbooking.vercel.app
RESEND_API_KEY=your-resend-key
GOOGLE_MAPS_API_KEY=your-maps-key
```

### Frontend (Vercel)
```
NEXT_PUBLIC_BACKEND_URL=https://backend.railway.app
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-key
```

## Deployment

Frontend auto-deploys via Vercel on push to `master`.
Backend auto-deploys via Railway on push to `master`.

## Recent Updates (February 2026)

### Backend Improvements
- ✅ **Railway Proxy Support**: Added `trust proxy` configuration for proper rate limiting behind Railway's reverse proxy
- ✅ **School Activation Workflow**: Schools now create with `status='suspended'` and activate only when SCHOOL_ADMIN accepts invitation
- ✅ **Type Safety**: Aligned DrivingSchool status field with PostgreSQL enum type

### Frontend Improvements
- ✅ **UI Text Cleanup**: Removed technical/server-side implementation details from user-facing pages
- ✅ **Text Readability**: Upgraded all grey text colors (text-slate-600 → text-slate-700 → text-slate-800) for better contrast and WCAG compliance
- ✅ **Type Fixes**: Updated DrivingSchool type to use `status: 'active' | 'suspended' | 'deleted'` enum instead of boolean

### Bug Fixes
- Fixed rate limiting errors with X-Forwarded-For headers on Railway
- Fixed schools showing as "Inactive" due to type mismatch (boolean vs enum)
- Fixed schools activating immediately instead of after email confirmation

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Documentation

- [CHANGELOG](./CHANGELOG.md) - Complete version history and recent changes
- [Backend README](./backend/README.md) - API setup, migrations, testing
- [Frontend README](./frontend/README.md) - UI setup and features
- [Domain Model](./docs/domain-model.md) - Entity relationships
- [Requirements](./docs/requirements.md) - Functional requirements
- [Operations Runbook](./docs/operations-runbook.md) - Deployment and troubleshooting
- [Local Launch Guide](./docs/local-launch.md) - Step-by-step setup

## NOT Implemented (Optional/Future)
- SMS notifications (Twilio)
- Password reset flow (forgot password page exists but backend not wired)
- E2E test coverage
- Lesson reminder emails (day before)
