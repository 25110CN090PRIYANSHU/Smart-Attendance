const teacherToken = localStorage.getItem("token");
let teacherUser = null;
try { teacherUser = JSON.parse(localStorage.getItem("user")); } catch (_) {}
if (!teacherToken || !teacherUser || teacherUser.role !== "teacher") { localStorage.clear(); window.location.href = "index.html"; }

let currentSessionId = localStorage.getItem("sessionId");
let sessionInfo = null;
let classroomLocation = null;
let refreshTimer = null;
let countdownTimer = null;

const $ = id => document.getElementById(id);
const apiHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${teacherToken}` });

function escapeText(value) { return String(value ?? ""); }

function showLocation(location) {
    classroomLocation = location;
    if (!location) {
        $("locationText").textContent = "Not configured — location checks are off.";
        $("locationStatus").textContent = "Optional";
        return;
    }
    $("locationText").textContent = `Configured: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
    $("locationStatus").textContent = "Configured";
}

function captureClassroomLocation() {
    if (!navigator.geolocation) return showToast("This browser does not support location.", "error");
    showToast("Requesting your current location…", "info");
    navigator.geolocation.getCurrentPosition(
        pos => {
            showLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            $("requireLocation").checked = true;
            showToast("Classroom location saved for this session.", "success");
        },
        err => showToast(`Location unavailable: ${err.message || "permission denied"}`, "error"),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

async function createSession() {
    const subject = $("subject").value.trim();
    const duration = Number($("duration").value);
    const qrIntervalSec = Number($("qrInterval").value);
    const requireLocation = $("requireLocation").checked;
    const requireDeviceBinding = $("requireDevice").checked;
    const radiusMeters = Number($("radiusMeters").value);
    const button = $("createSessionButton");

    if (!subject) return showToast("Enter a subject.", "warning");
    if (!Number.isFinite(duration) || duration < 1 || duration > 180) return showToast("Session duration must be 1–180 minutes.", "warning");
    if (!Number.isFinite(qrIntervalSec) || qrIntervalSec < 5 || qrIntervalSec > 60) return showToast("QR interval must be 5–60 seconds.", "warning");
    if (!Number.isFinite(radiusMeters) || radiusMeters < 10 || radiusMeters > 1000) return showToast("Radius must be 10–1000 meters.", "warning");
    if (requireLocation && !classroomLocation) return showToast("Set the classroom location first.", "warning");

    button.disabled = true;
    button.textContent = "Creating secure session…";
    try {
        const response = await fetch("/api/session/create", {
            method: "POST", headers: apiHeaders(),
            body: JSON.stringify({ subject, duration, qrIntervalSec, requireDeviceBinding, radiusMeters, classroomLocation: requireLocation ? classroomLocation : null })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Failed to create session");
        currentSessionId = String(data.sessionId);
        sessionInfo = data;
        localStorage.setItem("sessionId", currentSessionId);
        localStorage.setItem("attendanceSession", JSON.stringify({ sessionId: currentSessionId, subject: data.subject, startTime: data.startTime, expiryTime: data.expiryTime, qrIntervalSec: data.qrIntervalSec }));
        showSession(data);
        startSessionPolling();
        showToast("Secure attendance session started.", "success");
    } catch (error) { console.error(error); showToast(error.message, "error"); }
    finally { button.disabled = false; button.innerHTML = "<span>⚡</span> Generate Secure QR"; }
}

function showSession(data) {
    sessionInfo = { ...(sessionInfo || {}), ...data };
    $("qrSection").style.display = "block";
    $("qrSubject").textContent = `Attendance — ${escapeText(data.subject)}`;
    $("teacherLocationCheck").textContent = data.requireLocation ? `✓ Location: ${data.classroomLocation?.radiusMeters || 100}m` : "✓ Location: optional";
    $("qrImage").src = data.qrCode || "";
    updateCountdown(data);
}

function updateCountdown(data) {
    const now = Date.now();
    const expiry = new Date(data.expiryTime).getTime();
    const start = new Date(data.startTime).getTime();
    const interval = Number(data.qrIntervalSec) || 10;
    const slot = Number(data.qrSlot ?? Math.max(0, Math.floor((now - start) / (interval * 1000))));
    const nextRotation = start + (slot + 1) * interval * 1000;
    const remaining = Math.max(0, nextRotation - now);
    const seconds = Math.ceil(remaining / 1000);
    $("expiry").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    $("qrRefresh").textContent = `${seconds}s`;
    $("sessionEnds").textContent = new Date(expiry).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (expiry <= now || data.active === false) endLocalSession();
}

function startSessionPolling() {
    stopSessionPolling();
    refreshSessionQR();
    refreshTimer = setInterval(refreshSessionQR, 3000);
    countdownTimer = setInterval(() => { if (sessionInfo) updateCountdown(sessionInfo); }, 500);
}
function stopSessionPolling() { if (refreshTimer) clearInterval(refreshTimer); if (countdownTimer) clearInterval(countdownTimer); refreshTimer = countdownTimer = null; }

async function refreshSessionQR() {
    if (!currentSessionId) return;
    try {
        const response = await fetch(`/api/session/${encodeURIComponent(currentSessionId)}`, { headers: { Authorization: `Bearer ${teacherToken}` } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Session could not be loaded");
        if (!data.active) return endLocalSession();
        sessionInfo = data;
        $("qrImage").src = data.qrCode;
        $("teacherLocationCheck").textContent = data.requireLocation ? `✓ Location: ${data.classroomLocation?.radiusMeters || 100}m` : "✓ Location: optional";
        updateCountdown(data);
        loadLiveCounts();
    } catch (error) { console.error("Session refresh:", error); }
}

async function loadLiveCounts() {
    if (!currentSessionId) return;
    try {
        const response = await fetch(`/api/attendance/session/${currentSessionId}/summary`, { headers: { Authorization: `Bearer ${teacherToken}` } });
        if (!response.ok) return;
        const data = await response.json();
        $("livePresent").textContent = data.present ?? 0;
        $("liveFlagged").textContent = data.flagged ?? 0;
    } catch (_) {}
}

function endLocalSession() {
    stopSessionPolling();
    localStorage.removeItem("attendanceSession");
    localStorage.removeItem("sessionId");
    currentSessionId = null;
    if ($("qrSection")) { $("qrSection").style.display = "block"; $("qrImage").removeAttribute("src"); $("expiry").textContent = "SESSION ENDED"; }
}

async function closeSession() {
    if (!currentSessionId || !confirm("End this attendance session now?")) return;
    try {
        const response = await fetch(`/api/session/${currentSessionId}/close`, { method: "POST", headers: { Authorization: `Bearer ${teacherToken}` } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Could not close session");
        endLocalSession(); showToast("Attendance session closed.", "success");
    } catch (error) { showToast(error.message, "error"); }
}

function viewAttendance() { if (!currentSessionId) return showToast("No active session.", "warning"); window.location.href = `attendance.html?sessionId=${encodeURIComponent(currentSessionId)}`; }
function restoreSession() { const saved = localStorage.getItem("attendanceSession"); if (!saved) return; try { const data = JSON.parse(saved); if (new Date(data.expiryTime).getTime() <= Date.now()) return endLocalSession(); currentSessionId = data.sessionId; sessionInfo = data; showSession(data); startSessionPolling(); } catch (_) { localStorage.removeItem("attendanceSession"); } }
function logout() { stopSessionPolling(); ["token","user","sessionId","attendanceSession"].forEach(k => localStorage.removeItem(k)); window.location.href = "index.html"; }

document.addEventListener("DOMContentLoaded", () => { $("teacherName").textContent = `Welcome, ${teacherUser.name || "Teacher"} 👋`; restoreSession(); });
window.addEventListener("beforeunload", stopSessionPolling);
