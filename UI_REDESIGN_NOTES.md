# SmartAttend-X Dark Pro UI Update

## What changed
- Added `public/css/dark-pro.css`, a theme layer for the existing HTML/CSS/vanilla-JavaScript UI.
- Linked the theme stylesheet after `css/style.css` on every existing HTML page.
- Updated `public/js/darkmode.js`: Dark Pro is the default; the existing theme toggle switches to optional light mode and remembers the preference.
- Updated visible branding to `SmartAttend-X` where matching text was present.

## Pages styled
- `public/index.html` — login
- `public/register.html` — registration
- `public/reset.html` — password reset
- `public/student.html` — student dashboard
- `public/teacher.html` — teacher dashboard
- `public/admin.html` — admin control center
- `public/attendance.html` — live attendance
- `public/scan.html` — QR scanner

## Preserved
No backend route, MongoDB model, attendance rule, authentication logic, QR generation logic, or API endpoint was intentionally changed. The existing JavaScript and DOM IDs were retained.

## Run and verify
1. Extract the ZIP.
2. Run `npm install` if dependencies are not installed.
3. Set your environment variables in a local `.env` file (do not commit it).
4. Run `npm run dev`.
5. Verify login for student, teacher, and admin; QR creation/scanning; duplicate rejection; session expiry; and geofence behavior.

## Validation
`npm test` completed successfully using the repository's JavaScript syntax-check script.

## Notes
This is a CSS-led redesign of the existing screens, not a full component-framework rewrite. Real dashboards continue to depend on your backend API data. Sample values are not added to the application.
