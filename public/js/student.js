const studentToken = localStorage.getItem("token");
let studentUser = null;
try { studentUser = JSON.parse(localStorage.getItem("user")); } catch (_) {}
if (!studentToken || !studentUser || studentUser.role !== "student") { localStorage.clear(); window.location.href = "index.html"; }
const $ = id => document.getElementById(id);

function openScanner() { window.location.href = "scan.html"; }
function logout() { ["token","user","sessionId","attendanceSession"].forEach(k => localStorage.removeItem(k)); window.location.href = "index.html"; }

async function loadStudentSummary() {
    try {
        const response = await fetch("/api/attendance/student/me", { headers: { Authorization: `Bearer ${studentToken}` } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load attendance");
        $("studentClasses").textContent = data.totalSessions ?? 0;
        $("studentPresent").textContent = data.present ?? 0;
        $("studentAttendance").textContent = `${data.percentage ?? 0}%`;
        $("attendancePercentage").textContent = `${data.percentage ?? 0}%`;
        $("lastScan").textContent = data.lastScan ? new Date(data.lastScan).toLocaleDateString() : "—";
        const p = Number(data.percentage || 0);
        $("attendanceMessage").textContent = p >= 75 ? "Good attendance. Keep it consistent." : p >= 60 ? "Your attendance is getting low. Try not to miss upcoming classes." : "Low attendance detected. Attend upcoming classes regularly.";
        const history = $("studentHistory");
        if (!data.records?.length) { history.innerHTML = `<tr><td colspan="4" class="loading-cell">No attendance records yet.</td></tr>`; return; }
        history.innerHTML = data.records.slice(0, 30).map(r => `<tr><td><strong>${escapeHTML(r.subject)}</strong></td><td>${new Date(r.markedAt).toLocaleString()}</td><td><span class="present-badge">● ${escapeHTML(r.status)}</span></td><td>${Number(r.riskScore || 0) >= 50 ? "⚠️ Review" : "✓ Low"}</td></tr>`).join("");
    } catch (error) { console.error(error); $("attendanceMessage").textContent = "Could not load attendance right now."; }
}
function escapeHTML(value) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
document.addEventListener("DOMContentLoaded", () => { $("studentWelcome").textContent = `Welcome, ${studentUser.name || "Student"} 👋`; $("studentName").textContent = studentUser.name || "Student"; $("studentEmail").textContent = studentUser.email || ""; $("studentRoll").textContent = `Roll Number: ${studentUser.rollNumber || "N/A"}`; loadStudentSummary(); });
window.addEventListener("pageshow", loadStudentSummary);
