// SmartAttend-X theme manager: Clean light mode is default; Dark Pro is optional.
function applyTheme(isLight) {
  if (document.documentElement) {
    document.documentElement.classList.toggle("light-mode", isLight);
    document.documentElement.classList.toggle("dark-mode", !isLight);
  }
  if (document.body) {
    document.body.classList.toggle("light-mode", isLight);
    document.body.classList.toggle("dark-mode", !isLight);
  }
  updateThemeToggle(isLight);
}

function toggleDarkMode() {
  const currentIsLight = document.body ? document.body.classList.contains("light-mode") : true;
  const newIsLight = !currentIsLight;
  localStorage.setItem("darkMode", newIsLight ? "disabled" : "enabled");
  applyTheme(newIsLight);
}

function updateThemeToggle(isLight) {
  const button = document.getElementById("darkModeToggle");
  if (!button) return;
  button.textContent = isLight ? "🌙" : "☀️";
  button.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
  button.setAttribute("title", isLight ? "Switch to dark mode" : "Switch to light mode");
}

// Immediate theme execution on script load to prevent any flash of dark screen
(function initTheme() {
  const isDark = localStorage.getItem("darkMode") === "enabled";
  const isLight = !isDark;
  if (document.documentElement) {
    document.documentElement.classList.toggle("light-mode", isLight);
    document.documentElement.classList.toggle("dark-mode", !isLight);
  }
  if (document.body) {
    document.body.classList.toggle("light-mode", isLight);
    document.body.classList.toggle("dark-mode", !isLight);
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  const isDark = localStorage.getItem("darkMode") === "enabled";
  const isLight = !isDark;
  applyTheme(isLight);
});

