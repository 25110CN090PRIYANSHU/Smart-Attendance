# SmartAttend X 3.0

A privacy-first QR attendance system with short-lived cryptographic QR tokens, classroom geofencing, trusted-device binding, late tracking, risk scoring and teacher review.

## 3.0 highlights
- Server-side HMAC QR tokens that rotate every 5–60 seconds.
- Expiring QR sessions; old screenshots are rejected after the rotation grace period.
- Optional classroom geofencing using browser GPS.
- Optional trusted-device binding using an HMAC hash; raw device IDs are not stored.
- Present/Late/Flagged/Rejected/Excused workflow.
- Teacher review actions for flagged attendance.
- Subject-wise student attendance breakdown.
- Session summaries, CSV export and print-to-PDF.
- Login and attendance request rate limiting.
- Security headers and API validation.
- Express 4 compatibility to avoid the Router.use object error from the previous Express 5 dependency.

## Run locally
1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Fill in `MONGO_URI`, `JWT_SECRET` and `DEVICE_HASH_SECRET`.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:5000`.

## Render
Use:
- Build command: `npm install`
- Start command: `npm start`
- Root directory: blank if the repository root contains `package.json`
- Add the environment variables from `.env.example` in Render; never commit `.env`.

## Important browser limitations
GPS and camera permissions are browser-controlled. A normal web app cannot reliably read a phone's Wi-Fi BSSID, so SmartAttend does not fake Wi-Fi verification.

Risk scores are review signals, not proof of misconduct.
