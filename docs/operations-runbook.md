# Operations Runbook

**Updated: February 2026**

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

Connect using psql:
```bash
PGPASSWORD=<password> psql -h <host> -U postgres -p <port> -d railway
```

Apply migration:
```sql
-- Example: migration 0011
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT FALSE;
```

## Environment Variables

### Backend (Railway)
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing secret
- `FRONTEND_URL` - https://artinbooking.vercel.app
- `RESEND_API_KEY` - Email service
- `GOOGLE_MAPS_API_KEY` - Maps integration

### Frontend (Vercel)
- `NEXT_PUBLIC_BACKEND_URL` - Backend URL
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Maps integration
- `NEXT_PUBLIC_DEV_MODE` - Set to `false` for production

## Rollback

### Application Rollback
- **Vercel**: Promote a previous deployment
- **Railway**: Redeploy a previous commit

### Database Rollback
Prefer forward fixes. If needed, restore from Railway backup.

## Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Token expired - user needs to re-login |
| 500 on booking | Check driver has service center set |
| Emails not sending | Verify RESEND_API_KEY in Railway |
| Maps not loading | Verify GOOGLE_MAPS_API_KEY |
| Rate limit errors with X-Forwarded-For | Backend has `trust proxy` enabled for Railway - should auto-resolve |
| Schools show as "Inactive" | Frontend type mismatch fixed - redeploy frontend |
| Schools activate immediately | Fixed - schools now start suspended and activate on admin invitation acceptance |

## Recent Changes (February 2026)

### Backend Changes
- **Trust Proxy Configuration**: Backend now trusts Railway's reverse proxy (`app.set('trust proxy', 1)`)
  - Fixes rate limiting issues with X-Forwarded-For headers
  - Essential for production deployment on Railway
  - No configuration needed - works automatically

- **School Activation Workflow**: Schools lifecycle updated
  - New schools create with `status='suspended'`
  - Automatically activate when SCHOOL_ADMIN accepts invitation
  - Prevents premature school activation before email confirmation
  - Code location: `backend/src/repositories/drivingSchools.ts`

### Frontend Changes
- **Type Definitions**: DrivingSchool type updated
  - Changed from `active: boolean` to `status: 'active' | 'suspended' | 'deleted'`
  - Aligns with backend PostgreSQL enum
  - Fixes superadmin dashboard and homepage display issues

- **UI/UX Improvements**:
  - All grey text upgraded to darker shades for better readability
  - Technical jargon removed from student-facing pages
  - Improved WCAG accessibility compliance

### Database Schema
- No migration needed - schema already supports enum status field
- Existing schools may need manual status update if created before this change

## Logs

- **Vercel**: Dashboard → Functions → Logs
- **Railway**: Dashboard → Deployments → Logs

## Support Contacts

Update with your team contacts as needed.
