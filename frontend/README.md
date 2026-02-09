# artinbk frontend

Next.js (App Router) UI for the artinbk multi-tenant driving school platform. It provides role-aware dashboards for admins, drivers, and students plus a bookings workspace that calls the backend APIs when available and falls back to mocked data during local/offline development.

## Prerequisites
- Node.js 20+
- `NEXT_PUBLIC_BACKEND_URL` (defaults to `http://localhost:3001`)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for Google Identity Platform (optional when using local JWTs)

## Running locally

```bash
cd frontend
npm run dev
```

The app listens on http://localhost:3000.

### Auth workflow
- Visit `/login` and either:
  - Sign in with Google (requires `NEXT_PUBLIC_GOOGLE_CLIENT_ID`), or
  - Paste a locally issued RS256 JWT (works with the backend's local auth helper) and click **Use local token**.
- Tokens are stored in `localStorage` and decoded to populate email, role, and `schoolId` for route guards and API calls.

### Feature pages
- `/` – Overview hub with links to each workspace and a panel showing decoded JWT context
- `/admin` – School Admin workspace (drivers, students, settings, booking snapshot). Fetches school settings from `/schools/:id/settings`; list data is mocked until CRUD APIs are wired.
- `/driver` – Driver schedule and availability view with placeholder actions for publishing availability and responding to bookings.
- `/student` – Student portal to manage addresses, documents, and suggested slots (currently mocked).
- `/bookings` – Booking + availability view that queries `/availability` and `/bookings` when reachable and falls back to mocked data.

## Recent Improvements (Feb 2026)

### UI/UX Enhancements
- **Text Readability**: All grey text colors upgraded for better contrast and WCAG accessibility
  - `text-slate-600` → `text-slate-700` → `text-slate-800` for primary/secondary text
  - Affects all pages and components
  - Significantly improves legibility on light backgrounds

- **Technical Text Cleanup**: Removed server-side implementation details from user-facing text
  - Student portal now uses plain language descriptions
  - Booking cards show user-centric messages instead of policy enforcement details
  - Better UX for non-technical users

### Type Definitions
- **DrivingSchool Type**: Updated to match backend schema
  - Changed from `active: boolean` to `status: 'active' | 'suspended' | 'deleted'`
  - All components updated to use correct status enum
  - Fixes: superadmin dashboard, homepage active school count

### Next steps
- Replace remaining mocked lists with live backend data (drivers, students, bookings, addresses)
- Wire actions to POST/PUT/DELETE endpoints for bookings and availability updates
- Add component/UI tests for login, availability search, booking creation, and cancellation flows
- Consider adding loading states and optimistic UI updates for better perceived performance
