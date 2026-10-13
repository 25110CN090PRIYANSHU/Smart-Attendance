const token = localStorage.getItem("token");
let user = null;
try {
  user = JSON.parse(localStorage.getItem("user"));
} catch (_) {}

if (!token || !user || user.role !== "student") {
  localStorage.clear();
  location.href = "index.html";
}

const $ = (id) => document.getElementById(id);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c]
  );

async function api(url, opt = {}) {
  opt.headers = { ...(opt.headers || {}), Authorization: `Bearer ${token}` };
  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.message || "Request failed");
  return d;
}

async function loadStudentData() {
  try {
    const d = await api("/api/advanced/student/analytics");
    $("studentAttendance").textContent = `${d.percentage}%`;
    $("studentPresent").textContent = d.present;
    $("studentStreak").textContent = `${d.streak}`;
    $("needed75").textContent = d.neededFor75 === 0 ? "✓" : d.neededFor75;
    $("attendancePercentage").textContent = `${d.percentage}%`;
    $("attendanceMessage").textContent =
      d.percentage >= 75
        ? "🟢 You are above the 75% target."
        : `⚠️ Attendance shortage: ${d.neededFor75} future positive classes needed to reach 75%.`;
    $("attendanceBar").style.width = `${Math.min(100, d.percentage)}%`;
    $("monthlyScans").textContent = d.monthlyScans;
    $("subjectBreakdown").innerHTML =
      d.subjects
        .map(
          (s) => `<div class="info-card premium-info-card"><div class="info-icon ${
            s.percentage < 75 ? "orange" : "green"
          }">${s.percentage}%</div><div><h3>${esc(s.subject)}</h3><p>${
            s.present
          }/${s.total} positive • ${s.late} late • ${
            s.rejected
          } absent/rejected</p></div></div>`
        )
        .join("") || '<div class="info-card"><p>No finalized class data yet.</p></div>';

    const old = await api("/api/attendance/student/me");
    $("studentHistory").innerHTML =
      old.records
        .map(
          (r) =>
            `<tr><td>${esc(r.subject)}</td><td>${new Date(
              r.markedAt
            ).toLocaleString()}</td><td>${esc(r.status)}</td><td>${Number(
              r.riskScore || 0
            )}/100</td></tr>`
        )
        .join("") || '<tr><td colspan="4">No attendance records yet.</td></tr>';
  } catch (e) {
    showToast(e.message, "error");
  }
}

function updateProfileDisplay(u) {
  if (!u) return;
  $("studentWelcome").textContent = `Welcome, ${u.name || "Student"} 👋`;
  $("studentName").textContent = u.name || "Student";
  $("studentEmail").textContent = u.email || "";
  $("studentRoll").textContent = `Roll Number: ${u.rollNumber || "—"}`;

  const branchYearParts = [
    u.branch ? `Branch: ${u.branch}` : "",
    u.year ? `Year: ${u.year}` : "",
    u.section ? `Sec: ${u.section}` : "",
  ].filter(Boolean);
  if ($("studentBranchYear")) {
    $("studentBranchYear").textContent =
      branchYearParts.join(" • ") || "No branch/year configured";
  }

  const pPic = $("studentProfilePicture");
  if (u.profilePicture) {
    pPic.src = u.profilePicture;
    pPic.style.display = "block";
  } else {
    pPic.removeAttribute("src");
    pPic.style.display = "none";
  }
}

async function loadProfile() {
  try {
    const d = await api("/api/auth/me");
    if (d.user) {
      user = d.user;
      localStorage.setItem("user", JSON.stringify(d.user));
    }
  } catch (_) {}
  updateProfileDisplay(user);
}

// ==========================================
// PROFILE EDIT MODAL & ACTIONS
// ==========================================
let pendingAvatarDataUrl = null;
let avatarMarkedForRemoval = false;

function openProfileModal() {
  $("profileMessage").textContent = "";
  $("editName").value = user?.name || "";
  $("editEmail").value = user?.email || "";
  $("editRollNumber").value = user?.rollNumber || "";
  $("editBranch").value = user?.branch || "";
  $("editYear").value = user?.year || "";
  $("editSection").value = user?.section || "";
  $("editCurrentPassword").value = "";
  $("editNewPassword").value = "";

  pendingAvatarDataUrl = null;
  avatarMarkedForRemoval = false;

  const preview = $("editAvatarPreview");
  const fallback = $("editAvatarFallback");
  if (user?.profilePicture) {
    preview.src = user.profilePicture;
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
      // Auto-resize to crisp avatar dimensions (max 400x400) to keep base64 under 500KB limit
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
  const rollNumber = $("editRollNumber").value.trim();
  const branch = $("editBranch").value.trim();
  const year = $("editYear").value.trim();
  const section = $("editSection").value.trim();
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
  if (!rollNumber) {
    msgEl.textContent = "Roll number is required for students.";
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
    rollNumber,
    branch,
    year,
    section,
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
      user = d.user;
      localStorage.setItem("user", JSON.stringify(d.user));
      updateProfileDisplay(user);
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

async function loadNotifications() {
  try {
    const d = await api("/api/advanced/notifications");
    $("notifications").innerHTML =
      d.notifications
        .map(
          (n) =>
            `<div class="smart-list-item"><div><strong>${
              n.read ? "" : "🔔 "
            }${esc(n.title)}</strong><small>${esc(n.message)} • ${new Date(
              n.createdAt
            ).toLocaleString()}</small></div><span class="pill">${esc(
              n.type
            )}</span></div>`
        )
        .join("") || "<p>No notifications.</p>";
  } catch (e) {
    console.error(e);
  }
}

async function logoutAll() {
  if (!confirm("Revoke all active logins for this account?")) return;
  try {
    await api("/api/auth/logout-all", { method: "POST" });
    showToast(
      "All other sessions revoked. You will need to log in again on this device.",
      "success"
    );
  } catch (e) {
    showToast(e.message, "error");
  }
}

function openScanner() {
  location.href = "scan.html";
}

function logout() {
  localStorage.clear();
  location.href = "index.html";
}

window.logoutAll = logoutAll;
window.openScanner = openScanner;
window.logout = logout;
window.loadStudentData = loadStudentData;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.onAvatarFileSelected = onAvatarFileSelected;
window.removeAvatar = removeAvatar;
window.saveProfile = saveProfile;

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  loadStudentData();
  loadNotifications();
});
