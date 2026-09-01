// ===============================
// DARK MODE
// ===============================

function toggleDarkMode() {

    document.body.classList.toggle("dark-mode");

    // Save current mode
    if (document.body.classList.contains("dark-mode")) {

        localStorage.setItem("darkMode", "enabled");

    } else {

        localStorage.setItem("darkMode", "disabled");

    }
}


// ===============================
// LOAD SAVED MODE
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    const darkMode =
        localStorage.getItem("darkMode");

    if (darkMode === "enabled") {

        document.body.classList.add("dark-mode");

    }

});