# StayWise — Hotel Management System

A full-stack portfolio project designed around end-to-end product ownership: React + TypeScript UI, Node.js/Express REST API, MongoDB persistence, JWT authentication, role-aware APIs, room inventory, booking workflows, dashboard metrics, and deployment configuration.

## Features
- JWT login/register; roles: `admin` and `staff`
- Dashboard metrics and recent bookings
- Room inventory CRUD (admin/staff API; UI supports add/edit/delete)
- Booking creation, status changes, cancellation, and date-overlap availability checks
- Server-side validation, centralized error handling, security headers, rate limiting
- Responsive UI and seeded demo data
- Health endpoint: `GET /api/health`

## Requirements
- Node.js 20+
- MongoDB local or MongoDB Atlas connection string

## Run locally
1. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`, `JWT_SECRET`.
2. In terminal:
   ```bash
   cd server
   npm install
   npm run seed
   npm run dev
   ```
3. In a second terminal:
   ```bash
   cd client
   npm install
   npm run dev
   ```
4. Open the Vite URL (usually http://localhost:5173).

### Demo account
Seed script creates:
- Admin: `admin@staywise.demo`
- Password: `StaywiseDemo123!`

Change the password and JWT secret before using anything outside local development.

## Deploy
### API (Render / Railway / similar)
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (your deployed frontend URL), `NODE_ENV=production`
- Health check path: `/api/health`

### Frontend (Vercel / Netlify / Render Static Site)
- Root directory: `client`
- Build command: `npm install && npm run build`
- Output directory: `dist`
- Set `VITE_API_URL` to your deployed API URL, e.g. `https://your-api.onrender.com/api`

## Important production checklist
- Use a managed MongoDB deployment with network access restricted appropriately.
- Set a long random JWT secret in deployment secrets.
- Add email verification, password reset, audit logs, automated tests, and payment-provider integration before real commercial use.
- Demo data and credentials are for portfolio evaluation only.
