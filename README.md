# artinbk - Driving School Booking Platform

**Status: Production Ready (January 2026)**

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

## NOT Implemented (Optional/Future)
- SMS notifications (Twilio)
- Password reset flow
- E2E test coverage
- Lesson reminder emails (day before)
