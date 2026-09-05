# SmartAttend X 4.0

A production-style QR attendance platform for college classrooms. It combines dynamic cryptographic QR attendance with classroom geofencing, trusted devices, risk review, live monitoring, academic administration and attendance analytics.

## What's new in 4.0

1. Complete admin control center: users, subjects, teachers, classrooms, timetable, reports and security.
2. Attendance analytics: overall and subject-level health, streaks and 75% shortage guidance.
3. Automatic absentee marking after a session expires, plus manual finalization.
4. Multi-layer anti-proxy checks: rotating QR, GPS, trusted device, device sharing and impossible-movement risk signals.
5. Trusted-device reset control for administrators.
6. Login security: failed-login lockout, login history, session revocation, optional email verification and optional admin email 2FA.
7. Full-screen-style live QR experience with refresh countdown and session controls.
8. Real-time teacher attendance updates through Server-Sent Events (SSE).
9. Configurable classroom geofence with radius.
10. Timetable and academic scheduling with teacher/subject/room assignment.
11. Low-attendance warnings and 75% target calculator.
12. CSV reports that open in Excel plus browser Print-to-PDF.
13. In-app security and attendance notifications.
14. Responsive modern dashboard with dark mode and mobile-friendly layouts.
15. Built-in attendance assistant for common analytics questions without requiring an external AI API.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5000`.

## Required environment variables

Copy `.env.example` to `.env` and set:

- `MONGO_URI`
- `JWT_SECRET` (32+ characters)
- `DEVICE_HASH_SECRET` (32+ characters recommended)
- `PORT` (optional; Render provides it automatically)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

For real password reset / email verification / admin 2FA emails, configure the SMTP variables in `.env.example`.

## Optional admin 2FA

Set `ADMIN_2FA_ENABLED=true`. The admin receives a 6-digit code by email when SMTP is configured. In local development, the code is returned in the API response for testing when SMTP is not configured.

## Important deployment note

Do not commit `.env`. On Render, put environment variables in the service's Environment settings. After changing them, redeploy the service.

## Architecture

- Node.js + Express 4
- MongoDB + Mongoose
- HTML/CSS/vanilla JavaScript frontend
- HMAC-SHA256 rotating QR tokens
- Browser Geolocation API
- Server-Sent Events for live attendance
- SMTP via Nodemailer (optional)

## Security note

Risk scores are review signals, not proof of misconduct. A flagged attendance record should be reviewed by a teacher/admin before being rejected.
