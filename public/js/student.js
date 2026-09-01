// =====================================================
// STUDENT AUTHENTICATION
// =====================================================

const studentToken = localStorage.getItem("token");

let studentUser = null;

try {
    studentUser = JSON.parse(
        localStorage.getItem("user")
    );
} catch (error) {
    console.error("Invalid student data:", error);
}


// =====================================================
// CHECK STUDENT LOGIN
// =====================================================

if (
    !studentToken ||
    !studentUser ||
    studentUser.role !== "student"
) {
    localStorage.clear();
    window.location.href = "index.html";
}


// =====================================================
// SHOW STUDENT INFORMATION
// =====================================================

function loadStudentInformation() {

    const studentName =
        document.getElementById("studentName");

    const rollNumber =
        document.getElementById("rollNumber");


    if (studentName) {

        studentName.innerText =
            `Welcome, ${studentUser.name}`;
    }


    if (rollNumber) {

        rollNumber.innerText =
            `Roll Number: ${
                studentUser.rollNumber || "N/A"
            }`;
    }
}


// =====================================================
// OPEN QR SCANNER
// =====================================================

function openScanner() {

    // Add exit animation
    document.body.classList.add(
        "page-exit"
    );


    setTimeout(() => {

        window.location.href =
            "scan.html";

    }, 250);
}


// =====================================================
// LOGOUT
// =====================================================

function logout() {

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Keep any other application data
    // unless you specifically want to clear it.

    window.location.href =
        "index.html";
}


// =====================================================
// RESET PAGE
// Fix blank page after browser BACK
// =====================================================

function resetStudentPage() {

    const body =
        document.body;

    if (!body) {
        return;
    }


    // Remove animation classes
    body.classList.remove(
        "page-exit"
    );


    body.classList.remove(
        "page-enter"
    );


    // Completely restore visibility
    body.style.opacity =
        "1";

    body.style.visibility =
        "visible";

    body.style.transform =
        "none";

    body.style.filter =
        "none";


    // Force all major dashboard
    // containers to become visible
    const containers =
        document.querySelectorAll(
            "main, section, nav, .container, .dashboard, .student-dashboard"
        );


    containers.forEach(element => {

        element.style.visibility =
            "visible";

        element.style.opacity =
            "1";

        element.style.transform =
            "none";

    });
}


// =====================================================
// PAGE INITIALIZATION
// =====================================================

function initializeStudentDashboard() {

    loadStudentInformation();

    resetStudentPage();

}


// =====================================================
// NORMAL PAGE LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeStudentDashboard();

    }
);


// =====================================================
// BROWSER BACK / FORWARD
// =====================================================

window.addEventListener(
    "pageshow",
    () => {

        // Small delay allows the browser
        // to finish restoring the page.
        setTimeout(() => {

            initializeStudentDashboard();

        }, 50);

    }
);


// =====================================================
// PAGE SHOW AFTER RETURNING FROM SCANNER
// =====================================================

window.addEventListener(
    "focus",
    () => {

        resetStudentPage();

    }
);


// =====================================================
// BEFORE PAGE LEAVES
// =====================================================

window.addEventListener(
    "pagehide",
    () => {

        // Do NOT leave the dashboard
        // stuck in the exit animation.
        document.body.classList.remove(
            "page-exit"
        );

    }
);