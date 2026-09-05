const scanToken = localStorage.getItem("token");
let scanUser = null;
try { scanUser = JSON.parse(localStorage.getItem("user")); } catch (_) {}
if (!scanToken || !scanUser || scanUser.role !== "student") { localStorage.clear(); window.location.href = "index.html"; }

let scanner = null;
let scannerRunning = false;
let processingScan = false;
let lastDecoded = "";
let lastDecodedAt = 0;

function getDeviceId() {
    let id = localStorage.getItem("smartAttendDeviceId");
    if (!id || id.length < 16) {
        id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}-${Math.random()}`);
        localStorage.setItem("smartAttendDeviceId", id);
    }
    return id;
}

function getLocation() {
    return new Promise(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 9000, maximumAge: 5000 }
        );
    });
}

async function startScanner() {
    if (scannerRunning) return;
    const reader = document.getElementById("reader");
    if (!reader) return showScanError("Scanner area is unavailable.");
    if (typeof Html5Qrcode === "undefined") return showScanError("QR scanner library could not be loaded. Check your internet connection.");
    reader.innerHTML = "";
    try { scanner = new Html5Qrcode("reader"); }
    catch (error) { console.error(error); return showScanError("QR scanner could not be created."); }

    let cameras;
    try { cameras = await Html5Qrcode.getCameras(); }
    catch (error) { console.error(error); return showScanError("Unable to access your camera. Allow camera permission and try again."); }
    if (!cameras?.length) return showScanError("No camera was found on this device.");
    const selectedCamera = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[0];
    try {
        await scanner.start(selectedCamera.id, {
            fps: 10,
            qrbox: (w, h) => { const size = Math.floor(Math.min(w, h) * 0.7); return { width: size, height: size }; },
            aspectRatio: 1,
            disableFlip: false
        }, async decodedText => {
            const now = Date.now();
            if (decodedText === lastDecoded && now - lastDecodedAt < 2000) return;
            lastDecoded = decodedText; lastDecodedAt = now;
            await onScanSuccess(decodedText);
        }, () => {});
        scannerRunning = true;
        updateScannerStatus("Scanning for secure QR…", "Keep the live QR inside the frame.");
    } catch (error) { console.error(error); scannerRunning = false; showScanError("Unable to start camera. Check camera permission."); }
}

async function onScanSuccess(decodedText) {
    if (processingScan) return;
    processingScan = true;
    let qrData;
    try { qrData = JSON.parse(decodedText); } catch (_) { processingScan = false; return showScanError("This is not a valid SmartAttend QR."); }
    if (qrData.v !== 2 || !qrData.sessionId || !qrData.token || !Number.isInteger(Number(qrData.slot))) { processingScan = false; return showScanError("Invalid or unsupported attendance QR."); }

    await stopScanner();
    updateScannerStatus("QR verified locally", "Checking location, device trust and session security…");
    const result = document.getElementById("result");
    if (result) result.innerHTML = `<div class="scan-processing">⏳ Verifying attendance…</div>`;

    const location = await getLocation();
    try {
        const response = await fetch("/api/attendance/mark", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${scanToken}` },
            body: JSON.stringify({ sessionId: qrData.sessionId, token: qrData.token, slot: Number(qrData.slot), deviceId: getDeviceId(), location })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            processingScan = false;
            showScanError(data.message || "Attendance could not be marked.");
            setTimeout(startScanner, 1600);
            return;
        }
        showSuccessScreen(data.message || "Attendance marked successfully!", data);
    } catch (error) {
        console.error(error);
        processingScan = false;
        showScanError("Network/server error. Check your connection and try again.");
        setTimeout(startScanner, 1600);
    }
}

async function stopScanner() {
    if (!scanner || !scannerRunning) return;
    try { await scanner.stop(); } catch (error) { console.warn("Camera stop:", error); }
    scannerRunning = false;
}

function showSuccessScreen(message, data) {
    const reader = document.getElementById("reader");
    const result = document.getElementById("result");
    if (reader) reader.innerHTML = `<div class="success-animation"><div class="success-circle">✓</div><h2>Attendance Marked!</h2><p>${escapeHTML(message)}</p></div>`;
    if (result) result.innerHTML = `<div class="success-message">✓ QR verified & attendance recorded</div><div class="verification-grid"><span>QR ✓</span><span>Location ${data.verified?.location ? "✓" : "—"}</span><span>Device ${data.verified?.device ? "✓" : "Flagged"}</span></div>`;
    updateScannerStatus(data.attendance?.status === "Flagged" ? "Recorded for review" : "Attendance verified", data.attendance?.status === "Flagged" ? "Your attendance was recorded, but the teacher should review the device verification." : "Your attendance has been securely recorded.");
}
function showScanError(message) { const result = document.getElementById("result"); if (result) result.innerHTML = `<div class="error-message">❌ ${escapeHTML(message)}</div>`; updateScannerStatus("Scan not completed", "Fix the issue above and try again."); }
function updateScannerStatus(title, description) { const titleEl = document.querySelector(".scan-status strong"); const desc = document.querySelector(".scan-status p"); if (titleEl) titleEl.textContent = title; if (desc) desc.textContent = description; }
async function goBack() { await stopScanner(); window.location.href = "student.html"; }
function escapeHTML(value) { return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
document.addEventListener("DOMContentLoaded", () => setTimeout(startScanner, 300));
window.addEventListener("beforeunload", () => { if (scanner && scannerRunning) scanner.stop().catch(() => {}); });
