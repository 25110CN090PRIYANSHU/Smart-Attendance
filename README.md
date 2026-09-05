# SmartAttend X 2.0

A QR-based attendance system upgraded with short-lived rotating QR tokens, optional classroom geofencing, trusted-device binding, attendance risk scoring, live monitoring and CSV/PDF-friendly reports.

## Main security flow

1. Teacher starts a session.
2. Server creates a private QR secret and a session expiry time.
3. The displayed QR changes every configured interval (default 10 seconds).
4. The QR token is generated server-side with HMAC-SHA256; the secret is never sent to the browser.
5. Student scans the current QR.
6. Server validates the session, QR slot/token and duplicate attendance.
7. If enabled, GPS location is checked against the classroom radius.
8. If enabled, the student's first verified browser device is trusted and later devices are flagged.
9. A risk score and verification flags are stored with the attendance record.
10. Teacher sees live attendance and can export CSV or print/save a PDF report.

## Setup

Create a `.env` file from `.env.example` and set `MONGO_URI` and a JWT secret of at least 32 characters.

```bash
npm install
npm start
```

Open `http://localhost:5000`.

For camera and GPS access on phones, deploy over HTTPS. `localhost` is also treated as a secure context by modern browsers.

## Important browser limitation

A normal web browser cannot reliably expose the college Wi-Fi BSSID/network identity to JavaScript. This version therefore does **not** pretend to perform Wi-Fi verification. If you later build a native Android app, Wi-Fi/network verification can be added as another factor.

## Existing database compatibility

Older sessions that do not have the new `qrSecret` field are upgraded automatically the first time the session is opened. Existing attendance records remain readable.
