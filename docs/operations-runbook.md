# Operations Runbook

**Updated: February 27, 2026**

This runbook covers operations for the artinbk platform deployed on Vercel + Railway.

## Current Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | https://artinbooking.vercel.app |
| Backend | Railway | Auto-assigned |
| Database | Railway PostgreSQL | Internal |
| Email | Resend API | service |

## Deployment

### Frontend (Auto-deploy via Vercel)
Push to `master` branch → Vercel auto-deploys

### Backend (Auto-deploy via Railway)
Push to `master` branch → Railway auto-deploys

### Manual Redeploy
- **Vercel**: Dashboard → Deployments → Redeploy
- **Railway**: Dashboard → Deployments → Redeploy

## Database Migrations

### Via Railway CLI
```bash
railway login
railway link        # select your project + environment
railway connect     # select PostgreSQL service → opens psql
```

Then run SQL from migration files in `db/migrations/` in order.

### Via psql directly
```bash
PGPASSWORD=<password> psql -h <host> -U postgres -p <port> -d railway
```

### Current migrations (21 total)
See `docs/CURRENT_STATUS.md` for the full migration list (0001–0021, gap at 0014).

## Environment Variables

### Backend (Railway)
| Variable | Description | Required |
|----------|-------------|----------|
| `PGHOST` | Database host (default: localhost) | Railway auto-sets |
| `PGPORT` | Database port (default: 5432) | Railway auto-sets |
| `PGUSER` | Database user (default: postgres) | Railway auto-sets |
| `PGPASSWORD` | Database password | **Yes** |
| `PGDATABASE` | Database name (default: artinbk) | Railway auto-sets |
| `RESEND_API_KEY` | Resend email service API key | **Yes** (emails fail silently if missing) |
| `EMAIL_FROM` | Sender email (default: onboarding@resend.dev) | No |
| `FRONTEND_URL` | Frontend URL (default: https://artinbooking.vercel.app) | No |
| `MAPS_API_KEY` | Google Maps Distance Matrix API key | No (falls back to haversine) |
| `AUTH_LOCAL_JWT` | Set to 'true' to enable local JWT auth | **Yes** |
| `AUTH_LOCAL_PRIVATE_KEY` | RS256 private key for JWT signing | **Yes** (if AUTH_LOCAL_JWT=true) |
| `AUTH_LOCAL_KEY_ID` | JWT key ID | **Yes** (if AUTH_LOCAL_JWT=true) |
| `AUTH_LOCAL_AUDIENCE` | JWT audience | **Yes** (if AUTH_LOCAL_JWT=true) |
| `ENABLE_REMINDER_SCHEDULER` | Set to 'true' to enable lesson reminders | **Yes** in production |
| `APP_NAME` | App name in emails (default: Artin Driving School) | No |

### Frontend (Vercel)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps JS API key |
| `NEXT_PUBLIC_DEV_MODE` | Set to `false` for production |

## Rollback

### Application Rollback
- **Vercel**: Promote a previous deployment
- **Railway**: Redeploy a previous commit

### Database Rollback
Prefer forward fixes. If needed, restore from Railway backup.

## Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Token expired - user needs to re-login (auto-logout after 7 days) |
| 500 on booking | Check driver has service center set |
| Emails not sending | Verify RESEND_API_KEY in Railway |
| Maps not loading | Verify GOOGLE_MAPS_API_KEY (frontend) and MAPS_API_KEY (backend) |
| Reminders not firing | Verify ENABLE_REMINDER_SCHEDULER=true in Railway |
| Schools show as "Inactive" | Check school status field — new schools start as 'suspended' |
| Rate limit errors | Backend has `trust proxy` enabled for Railway |

## Email System

### Supported email types
1. **Invitation** — sent when admin invites a student or driver
2. **Booking Confirmation** — sent to student (and guardian if minor) when lesson is booked
3. **Booking Cancellation** — sent to student (and guardian if minor) and driver when lesson is cancelled
4. **Lesson Reminder** — sent to student (and guardian if minor) and driver before the lesson

### Customizable templates
Admins can customize the subject line and add a custom note for each email type via the admin dashboard → Email Templates section. Templates support `{varName}` interpolation.

### Guardian email CC
For minor students (is_minor=true) with a guardian_email set, booking confirmation, cancellation, and lesson reminder emails are automatically sent to the guardian as well.

### Reminder timing
Each school can configure reminder timing (24h, 48h, or 72h before lesson) via admin settings → Reminder Timing.

## PWA

The app is installable as a Progressive Web App:
- `manifest.json` at `/manifest.json`
- Standalone display mode, theme color #1e40af
- Uses existing favicon.png and logo.png as icons

## Logs

- **Vercel**: Dashboard → Functions → Logs
- **Railway**: Dashboard → Deployments → Logs

## Support Contacts

Update with your team contacts as needed.
