# Artinbk Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ with PostGIS extension
- Domain with SSL certificate (for production)

---

## Environment Setup

### Backend

1. Copy the environment template:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Configure database connection:
   ```env
   PGHOST=your-db-host
   PGPORT=5432
   PGUSER=your-db-user
   PGPASSWORD=your-secure-password
   PGDATABASE=artinbk
   NODE_ENV=production
   ```

3. Run database migrations:
   ```bash
   psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f db/migrations/0001_init_schema.sql
   # Run all migrations in order...
   ```

### Frontend

1. Copy the environment template:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. Configure environment:
   ```env
   NEXT_PUBLIC_BACKEND_URL=https://api.your-domain.com
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-api-key
   NEXT_PUBLIC_DEV_MODE=false
   ```

---

## Build & Deploy

### Backend

```bash
cd backend
npm ci --production
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm ci
npm run build
npm start
```

---

## Recommended Hosting

| Component | Recommended Provider |
|-----------|---------------------|
| Frontend  | Vercel, Netlify     |
| Backend   | Railway, Render, Fly.io |
| Database  | Railway, Neon, Supabase |

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `NEXT_PUBLIC_DEV_MODE=false` (hides dev login buttons)
- [ ] Configure Google OAuth with production redirect URIs
- [ ] Enable HTTPS on both frontend and backend
- [ ] Set secure database credentials
- [ ] Run all database migrations
- [ ] Test login flow with real email/password

---

## Vercel Deployment (Frontend)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_BACKEND_URL`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - `NEXT_PUBLIC_DEV_MODE=false`
3. Deploy

---

## Railway Deployment (Backend + Database)

1. Create a new Railway project
2. Add PostgreSQL service (enable PostGIS)
3. Add Node.js service from your repo
4. Set environment variables from Railway's database connection
5. Add build command: `npm run build`
6. Add start command: `npm start`
