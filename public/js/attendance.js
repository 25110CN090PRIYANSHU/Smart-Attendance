const attendanceToken = localStorage.getItem("token");
let attendanceUser = null;
try { attendanceUser = JSON.parse(localStorage.getItem("user")); } catch (_) {}
if (!attendanceToken || !attendanceUser || attendanceUser.role !== "teacher") { localStorage.clear(); window.location.href = "index.html"; }
const sessionId = new URLSearchParams(location.search).get("sessionId");
let attendanceRecords = [];
let timer = null;
const $ = id => document.getElementById(id);
const headers = { Authorization: `Bearer ${attendanceToken}` };

async function loadAttendance() {
    if (!sessionId) { $("attendanceTable").innerHTML = `<tr><td colspan="6" class="loading-cell">No session ID was provided.</td></tr>`; return; }
    try {
        const [recordsResponse, summaryResponse] = await Promise.all([
            fetch(`/api/attendance/session/${encodeURIComponent(sessionId)}`, { headers }),
            fetch(`/api/attendance/session/${encodeURIComponent(sessionId)}/summary`, { headers })
        ]);
        const records = await recordsResponse.json().catch(() => []);
        const summary = await summaryResponse.json().catch(() => ({}));
        if (!recordsResponse.ok) throw new Error(records.message || "Failed to load attendance");
        attendanceRecords = Array.isArray(records) ? records : [];
        $("sessionTitle").textContent = `Attendance — ${summary.session?.subject || "Session"}`;
        $("presentCount").textContent = summary.present ?? attendanceRecords.filter(r => r.status === "Present").length;
        $("flaggedCount").textContent = summary.flagged ?? attendanceRecords.filter(r => r.status === "Flagged").length;
        $("absentCount").textContent = summary.absent ?? 0;
        $("percentage").textContent = `${summary.percentage ?? 0}%`;
        const active = Boolean(summary.session?.active);
        $("liveLabel").textContent = active ? "LIVE" : "ENDED";
        displayAttendance(attendanceRecords);
        $("lastUpdated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (error) { console.error(error); showToast(error.message || "Attendance loading failed", "error"); }
}
function displayAttendance(records) {
    const table = $("attendanceTable");
    if (!records.length) { table.innerHTML = `<tr><td colspan="6" class="loading-cell">No attendance marked yet.</td></tr>`; return; }
    table.innerHTML = records.map(record => {
        const s = record.studentId || {};
        const v = record.verification || {};
        const risk = Number(record.riskScore || 0);
        const riskText = risk >= 50 ? `⚠️ ${risk}` : `✓ ${risk}`;
        return `<tr><td><strong>${esc(s.rollNumber || "-")}</strong></td><td><div class="student-name-cell"><div class="student-avatar">${initials(s.name)}</div><span>${esc(s.name || "Unknown")}</span></div><small>${esc(s.email || "-")}</small></td><td>${record.markedAt ? new Date(record.markedAt).toLocaleTimeString() : "-"}</td><td><span class="verification-badges">QR ${v.qr ? "✓" : "✕"} · GPS ${v.location ? "✓" : "—"} · Device ${v.device ? "✓" : "⚠"}</span></td><td>${riskText}${record.location?.distanceMeters != null ? `<small>${record.location.distanceMeters}m</small>` : ""}</td><td><span class="present-badge">● ${esc(record.status || "Present")}</span></td></tr>`;
    }).join("");
}
function searchAttendance() { const q = $("attendanceSearch").value.toLowerCase().trim(); if (!q) return displayAttendance(attendanceRecords); displayAttendance(attendanceRecords.filter(r => { const s = r.studentId || {}; return `${s.name || ""} ${s.email || ""} ${s.rollNumber || ""}`.toLowerCase().includes(q); })); }
function exportAttendanceCSV() {
    if (!attendanceRecords.length) return showToast("No attendance to export.", "warning");
    const rows = [["Roll Number","Student Name","Email","Marked At","Status","Risk Score","Risk Flags","QR Verified","Location Verified","Device Verified","Distance (m)"]];
    attendanceRecords.forEach(r => { const s=r.studentId||{}, v=r.verification||{}; rows.push([s.rollNumber,s.name,s.email,r.markedAt,r.status,r.riskScore,(r.riskFlags||[]).join("; "),v.qr,v.location,v.device,r.location?.distanceMeters ?? ""]); });
    const csv = rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"})); a.download = `smartattend-${sessionId}.csv`; a.click(); URL.revokeObjectURL(a.href); showToast("CSV exported.", "success");
}
function initials(name) { const p=String(name||"?").trim().split(/\s+/); return p.length>1 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : p[0].slice(0,2).toUpperCase(); }
function esc(v) { return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function printReport() { window.print(); }
function goBack() { if (timer) clearInterval(timer); location.href="teacher.html"; }
document.addEventListener("DOMContentLoaded", () => { loadAttendance(); timer=setInterval(loadAttendance,5000); });
window.addEventListener("beforeunload", () => { if(timer) clearInterval(timer); });
