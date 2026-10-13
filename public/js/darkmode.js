// SmartAttend-X theme preference: Dark Pro is the default; light mode is optional.
function toggleDarkMode() {
  const useLight = !document.body.classList.contains("light-mode");
  document.body.classList.toggle("light-mode", useLight);
  localStorage.setItem("darkMode", useLight ? "disabled" : "enabled");
  updateThemeToggle();
}

function updateThemeToggle() {
  const button = document.getElementById("darkModeToggle");
  if (!button) return;
  const isLight = document.body.classList.contains("light-mode");
  button.textContent = isLight ? "☀️" : "☾";
  button.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
  button.setAttribute("title", isLight ? "Switch to dark mode" : "Switch to light mode");
}

document.addEventListener("DOMContentLoaded", () => {
  // Default to Dark Pro unless the user explicitly saved light mode.
  document.body.classList.toggle("light-mode", localStorage.getItem("darkMode") === "disabled");
  updateThemeToggle();
});
