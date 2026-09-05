// public/js/register.js

document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.getElementById("role");
  const teacherCodeGroup = document.getElementById("teacherCodeGroup");
  const teacherCodeInput = document.getElementById("teacherCode");

  // Show/hide teacher registration code field
  function updateTeacherCodeVisibility() {
    if (!roleSelect || !teacherCodeGroup || !teacherCodeInput) return;

    if (roleSelect.value === "teacher") {
      teacherCodeGroup.style.display = "block";
      teacherCodeInput.required = true;
    } else {
      teacherCodeGroup.style.display = "none";
      teacherCodeInput.required = false;
      teacherCodeInput.value = "";
    }
  }

  if (roleSelect) {
    roleSelect.addEventListener("change", updateTeacherCodeVisibility);
    updateTeacherCodeVisibility();
  }
});


async function register() {
  const name = document.getElementById("name")?.value.trim() || "";
  const email = document.getElementById("email")?.value.trim() || "";
  const password = document.getElementById("password")?.value || "";
  const role = document.getElementById("role")?.value || "";

  const rollNumber =
    document.getElementById("rollNumber")?.value.trim() || "";

  const teacherCode =
    document.getElementById("teacherCode")?.value.trim() || "";

  const profilePicture =
    document.getElementById("profilePicture")?.files?.[0];

  const message = document.getElementById("message");

  // Basic validation
  if (!name || !email || !password) {
    message.innerText = "Please fill all required fields.";
    return;
  }

  // Student validation
  if (role === "student" && !rollNumber) {
    message.innerText = "Roll number is required for students.";
    return;
  }

  // Teacher validation
  if (role === "teacher" && !teacherCode) {
    message.innerText = "Valid teacher registration code is required.";
    return;
  }

  try {
    let profileData = "";

    // Profile picture processing
    if (profilePicture) {
      // FIXED image validation regex
      if (
        !/^image\/(jpeg|png|webp)$/.test(profilePicture.type) ||
        profilePicture.size > 500 * 1024
      ) {
        message.innerText =
          "Profile picture must be JPG, PNG or WebP under 500KB.";
        return;
      }

      profileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;

        reader.readAsDataURL(profilePicture);
      });
    }

    // Send registration request
    const response = await fetch("/api/auth/register", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        name,
        email,
        password,
        role,
        rollNumber,
        teacherCode,

        profilePicture: profileData,

        branch:
          document.getElementById("branch")?.value || "",

        year:
          document.getElementById("year")?.value || "",

        section:
          document.getElementById("section")?.value || ""
      })
    });

    const data = await response.json().catch(() => ({}));

    message.innerText =
      data.message || "Registration failed";

    // Successful registration
    if (response.ok) {
      message.innerText =
        data.message || "Account created successfully!";

      setTimeout(() => {
        window.location.href = "index.html";
      }, 900);
    }

  } catch (error) {
    console.error("Registration error:", error);

    message.innerText =
      "Server error. Make sure the backend is running.";
  }
}