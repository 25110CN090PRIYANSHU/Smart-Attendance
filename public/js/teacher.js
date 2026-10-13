const teacherToken = localStorage.getItem("token");
let teacherUser = null;
try {
  teacherUser = JSON.parse(localStorage.getItem("user"));
} catch (_) {}

if (!teacherToken || !teacherUser || teacherUser.role !== "teacher") {
  localStorage.clear();
  location.href = "index.html";
}

let currentSessionId = localStorage.getItem("sessionId"),
  sessionInfo = null,
  classroomLocation = null,
  refreshTimer = null,
  countdownTimer = null,
  eventSource = null;

const $ = (id) => document.getElementById(id);
const auth = () => ({ Authorization: `Bearer ${teacherToken}` });

async function api(url, opt = {}) {
  opt.headers = { ...(opt.headers || {}), ...auth() };
  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.message || "Request failed");
  return d;
}

// ==========================================
// TEACHER PROFILE DISPLAY & EDITING
// ==========================================
let pendingAvatarDataUrl = null;
let avatarMarkedForRemoval = false;

function updateTeacherProfileDisplay(u) {
  if (!u) return;
  if ($("teacherName")) {
    $("teacherName").textContent = `Welcome, ${u.name || "Teacher"} 👋`;
  }
  if ($("teacherDisplayName")) {
    $("teacherDisplayName").textContent = u.name || "Teacher";
  }
  if ($("teacherEmail")) {
    $("teacherEmail").textContent = u.email || "";
  }
  if ($("teacherDepartment")) {
    $("teacherDepartment").textContent = `Department / Branch: ${
      u.branch || "Not configured"
    }`;
  }

  const pPic = $("teacherProfilePicture");
  const fallback = $("teacherAvatarFallback");
  if (pPic) {
    if (u.profilePicture) {
      pPic.src = u.profilePicture;
      pPic.style.display = "block";
      if (fallback) fallback.style.display = "none";
    } else {
      pPic.removeAttribute("src");
      pPic.style.display = "none";
      if (fallback) fallback.style.display = "flex";
    }
  }
}

async function loadTeacherProfile() {
  try {
    const d = await api("/api/auth/me");
    if (d.user) {
      teacherUser = d.user;
      localStorage.setItem("user", JSON.stringify(d.user));
    }
  } catch (_) {}
  updateTeacherProfileDisplay(teacherUser);
}

function openProfileModal() {
  $("profileMessage").textContent = "";
  $("editName").value = teacherUser?.name || "";
  $("editEmail").value = teacherUser?.email || "";
  $("editBranch").value = teacherUser?.branch || "";
  $("editCurrentPassword").value = "";
  $("editNewPassword").value = "";

  pendingAvatarDataUrl = null;
  avatarMarkedForRemoval = false;

  const preview = $("editAvatarPreview");
  const fallback = $("editAvatarFallback");
  if (teacherUser?.profilePicture) {
    preview.src = teacherUser.profilePicture;
    preview.style.display = "block";
    fallback.style.display = "none";
  } else {
    preview.removeAttribute("src");
    preview.style.display = "none";
    fallback.style.display = "flex";
  }

  $("profileModal").hidden = false;
}

function closeProfileModal() {
  $("profileModal").hidden = true;
  $("profileMessage").textContent = "";
  pendingAvatarDataUrl = null;
  avatarMarkedForRemoval = false;
}

function onAvatarFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    showToast("Please choose a valid JPG, PNG, or WebP image", "warning");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (evt) {
    const img = new Image();
    img.onload = function () {
      const maxDim = 400;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      pendingAvatarDataUrl = dataUrl;
      avatarMarkedForRemoval = false;

      const preview = $("editAvatarPreview");
      const fallback = $("editAvatarFallback");
      preview.src = dataUrl;
      preview.style.display = "block";
      fallback.style.display = "none";
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function removeAvatar() {
  pendingAvatarDataUrl = null;
  avatarMarkedForRemoval = true;
  $("editAvatarFile").value = "";
  const preview = $("editAvatarPreview");
  const fallback = $("editAvatarFallback");
  preview.removeAttribute("src");
  preview.style.display = "none";
  fallback.style.display = "flex";
}

async function saveProfile(e) {
  e.preventDefault();
  const msgEl = $("profileMessage");
  msgEl.textContent = "";

  const name = $("editName").value.trim();
  const email = $("editEmail").value.trim();
  const branch = $("editBranch").value.trim();
  const currentPassword = $("editCurrentPassword").value;
  const newPassword = $("editNewPassword").value;

  if (name.length < 2) {
    msgEl.textContent = "Full name must be at least 2 characters.";
    return;
  }
  if (!email) {
    msgEl.textContent = "Valid email is required.";
    return;
  }
  if (newPassword && newPassword.length < 6) {
    msgEl.textContent = "New password must be at least 6 characters.";
    return;
  }
  if (newPassword && !currentPassword) {
    msgEl.textContent = "Current password is required to set a new password.";
    return;
  }

  const payload = {
    name,
    email,
    branch,
  };

  if (avatarMarkedForRemoval) {
    payload.profilePicture = "";
  } else if (pendingAvatarDataUrl) {
    payload.profilePicture = pendingAvatarDataUrl;
  }

  if (newPassword) {
    payload.currentPassword = currentPassword;
    payload.newPassword = newPassword;
  }

  const saveBtn = $("saveProfileBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const d = await api("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (d.user) {
      teacherUser = d.user;
      localStorage.setItem("user", JSON.stringify(d.user));
      updateTeacherProfileDisplay(teacherUser);
    }

    closeProfileModal();
    showToast(d.message || "Profile updated successfully", "success");
  } catch (err) {
    msgEl.textContent = err.message || "Failed to update profile";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Save Changes";
  }
}

// ==========================================
// SESSION & LOCATION MANAGEMENT
// ==========================================
function showLocation(l) {
  classroomLocation = l;
  $("locationText").textContent = `Configured: ${l.lat.toFixed(6)}, ${l.lng.toFixed(6)}`;
  $("locationStatus").textContent = "Configured";
}

function captureClassroomLocation() {
  if (!navigator.geolocation) return showToast("Geolocation is unavailable", "error");
  navigator.geolocation.getCurrentPosition(
    (p) => {
      showLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
      $("requireLocation").checked = true;
      showToast("Classroom GPS captured", "success");
    },
    (e) => showToast(e.message || "Location permission denied", "error"),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

async function createSession() {
  const body = {
    subject: $("subject").value.trim(),
    room: $("room").value.trim(),
    branch: $("branch").value.trim(),
    year: $("year").value.trim(),
    section: $("section").value.trim(),
    duration: Number($("duration").value),
    qrIntervalSec: Number($("qrInterval").value),
    lateAfterMinutes: Number($("lateAfter").value),
    radiusMeters: Number($("radiusMeters").value),
    requireDeviceBinding: $("requireDevice").checked,
    classroomLocation: $("requireLocation").checked ? classroomLocation : null,
  };
  if (!body.subject) return showToast("Enter a subject", "warning");
  if (body.requireLocation && !classroomLocation)
    return showToast("Capture classroom location first", "warning");
  try {
    const d = await api("/api/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    currentSessionId = String(d.sessionId);
    sessionInfo = d;
    localStorage.setItem("sessionId", currentSessionId);
    localStorage.setItem("attendanceSession", JSON.stringify(d));
    showSession(d);
    startPolling();
    showToast("Secure class started", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}

function showSession(d) {
  $("qrSection").style.display = "block";
  $("noSession").style.display = "none";
  $("qrSubject").textContent = `${d.subject}${d.room ? " · " + d.room : ""}`;
  $("qrImage").src = d.qrCode || "";
  $("teacherLocationCheck").textContent = d.requireLocation
    ? `✓ GPS radius: ${d.classroomLocation?.radiusMeters || 100}m`
    : "✓ Location: optional";
  updateCountdown(d);
}

function updateCountdown(d) {
  const now = Date.now(),
    exp = new Date(d.expiryTime).getTime(),
    start = new Date(d.startTime).getTime(),
    interval = Number(d.qrIntervalSec) || 10,
    slot = Number(
      d.qrSlot ?? Math.max(0, Math.floor((now - start) / (interval * 1000)))
    ),
    remain = Math.max(0, start + (slot + 1) * interval * 1000 - now),
    sec = Math.ceil(remain / 1000);
  $("qrRefresh").textContent = `${sec}s`;
  $("sessionEnds").textContent = new Date(exp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (exp <= now || d.active === false) endLocalSession();
}

function startPolling() {
  stopPolling();
  refreshSessionQR();
  refreshTimer = setInterval(refreshSessionQR, 3000);
  countdownTimer = setInterval(() => sessionInfo && updateCountdown(sessionInfo), 500);
  if (eventSource) eventSource.close();
  eventSource = new EventSource(
    `/api/advanced/stream/${encodeURIComponent(
      currentSessionId
    )}?token=${encodeURIComponent(teacherToken)}`
  );
  eventSource.addEventListener("attendance", (e) => {
    loadLiveCounts();
    try {
      const d = JSON.parse(e.data);
      if (d.status === "Flagged") showToast("A suspicious scan was flagged", "warning");
    } catch (_) {}
  });
}

function stopPolling() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (countdownTimer) clearInterval(countdownTimer);
  if (eventSource) eventSource.close();
  refreshTimer = countdownTimer = null;
  eventSource = null;
}

async function refreshSessionQR() {
  if (!currentSessionId) return;
  try {
    const d = await api(`/api/session/${encodeURIComponent(currentSessionId)}`);
    if (!d.active) return endLocalSession();
    sessionInfo = d;
    $("qrImage").src = d.qrCode;
    updateCountdown(d);
    loadLiveCounts();
  } catch (e) {
    console.warn(e.message);
  }
}

async function loadLiveCounts() {
  if (!currentSessionId) return;
  try {
    const d = await api(`/api/attendance/session/${currentSessionId}/summary`);
    $("livePresent").textContent = (d.present || 0) + (d.late || 0);
    $("liveFlagged").textContent = d.flagged || 0;
  } catch (_) {}
}

async function finalizeSession() {
  if (!currentSessionId) return showToast("No active session", "warning");
  if (!confirm("Finalize this class and mark students who did not scan as absent?")) return;
  try {
    const d = await api(`/api/advanced/session/${currentSessionId}/finalize`, {
      method: "POST",
    });
    showToast(d.message, "success");
    endLocalSession();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function closeSession() {
  if (!currentSessionId || !confirm("End this session now?")) return;
  try {
    await api(`/api/session/${currentSessionId}/close`, { method: "POST" });
    endLocalSession();
    showToast("Session ended", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}

function endLocalSession() {
  stopPolling();
  localStorage.removeItem("attendanceSession");
  localStorage.removeItem("sessionId");
  currentSessionId = null;
  $("qrSection").style.display = "none";
  $("noSession").style.display = "block";
  $("qrImage").removeAttribute("src");
}

function viewAttendance() {
  if (currentSessionId)
    location.href = `attendance.html?sessionId=${encodeURIComponent(currentSessionId)}`;
  else showToast("No active session", "warning");
}

function restoreSession() {
  const s = localStorage.getItem("attendanceSession");
  if (!s) return;
  try {
    const d = JSON.parse(s);
    if (new Date(d.expiryTime).getTime() <= Date.now()) return endLocalSession();
    currentSessionId = d.sessionId;
    sessionInfo = d;
    showSession(d);
    startPolling();
  } catch (_) {
    localStorage.removeItem("attendanceSession");
  }
}

async function loadTimetable() {
  try {
    const d = await api("/api/advanced/timetable");
    $("teacherTimetable").innerHTML =
      d.timetable
        .map(
          (x) =>
            `<tr><td>${x.dayName}</td><td>${x.startTime}–${x.endTime}</td><td><strong>${
              x.subjectId?.code || ""
            }</strong> ${x.subjectId?.name || ""}</td><td>${
              x.classroomId?.name || "—"
            }</td></tr>`
        )
        .join("") || '<tr><td colspan="4">No timetable slots assigned.</td></tr>';
  } catch (e) {
    $("teacherTimetable").innerHTML = `<tr><td colspan="4">${e.message}</td></tr>`;
  }
}

function logout() {
  stopPolling();
  localStorage.clear();
  location.href = "index.html";
}

window.createSession = createSession;
window.captureClassroomLocation = captureClassroomLocation;
window.finalizeSession = finalizeSession;
window.closeSession = closeSession;
window.viewAttendance = viewAttendance;
window.loadTimetable = loadTimetable;
window.logout = logout;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.onAvatarFileSelected = onAvatarFileSelected;
window.removeAvatar = removeAvatar;
window.saveProfile = saveProfile;

document.addEventListener("DOMContentLoaded", () => {
  loadTeacherProfile();
  restoreSession();
  loadTimetable();
});

window.addEventListener("beforeunload", stopPolling);
