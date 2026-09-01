// =====================================================
// TEACHER AUTHENTICATION
// =====================================================

const token = localStorage.getItem("token");

let user = null;

try {
    user = JSON.parse(localStorage.getItem("user"));
} catch (error) {
    console.error("Invalid user data:", error);
}

// Check teacher login
if (!token || !user || user.role !== "teacher") {
    localStorage.clear();
    window.location.href = "index.html";
}


// =====================================================
// SHOW TEACHER NAME
// =====================================================

const teacherName = document.getElementById("teacherName");

if (teacherName && user) {
    teacherName.innerText = `Welcome, ${user.name}`;
}


// =====================================================
// CURRENT SESSION
// =====================================================

let currentSessionId =
    localStorage.getItem("sessionId");

let countdownInterval = null;


// =====================================================
// GET SAVED ATTENDANCE SESSION
// =====================================================

function getSavedSession() {

    const savedSession =
        localStorage.getItem("attendanceSession");

    if (!savedSession) {
        return null;
    }

    try {
        return JSON.parse(savedSession);
    } catch (error) {

        console.error(
            "Invalid attendance session:",
            error
        );

        localStorage.removeItem(
            "attendanceSession"
        );

        return null;
    }
}


// =====================================================
// SHOW QR ON PAGE
// =====================================================

function showSavedQR(session) {

    if (!session) {
        return;
    }

    if (
        !session.sessionId ||
        !session.qrCode ||
        !session.expiryTime
    ) {
        return;
    }


    // ---------------------------------------------
    // Check expiry
    // ---------------------------------------------

    const expiry =
        new Date(session.expiryTime).getTime();

    const now =
        Date.now();

    if (expiry <= now) {

        clearSavedSession();

        return;
    }


    // ---------------------------------------------
    // Restore session ID
    // ---------------------------------------------

    currentSessionId =
        session.sessionId;

    localStorage.setItem(
        "sessionId",
        session.sessionId
    );


    // ---------------------------------------------
    // QR SECTION
    // ---------------------------------------------

    const qrSection =
        document.getElementById("qrSection");

    if (qrSection) {

        qrSection.style.display = "block";

        qrSection.classList.add(
            "card-visible"
        );
    }


    // ---------------------------------------------
    // QR IMAGE
    // ---------------------------------------------

    const qrImage =
        document.getElementById("qrImage");

    if (qrImage) {

        qrImage.onload = function () {

            qrImage.style.display = "block";

        };

        qrImage.src =
            session.qrCode;

        qrImage.style.display =
            "block";

        /*
         * Do NOT force width/height using
         * JavaScript.
         *
         * CSS should control the QR size.
         */
    }


    // ---------------------------------------------
    // SUBJECT
    // ---------------------------------------------

    const qrSubject =
        document.getElementById("qrSubject");

    if (qrSubject) {

        qrSubject.innerText =
            `Subject: ${session.subject || "-"}`;
    }


    // ---------------------------------------------
    // COUNTDOWN
    // ---------------------------------------------

    startCountdown(
        session.expiryTime
    );
}


// =====================================================
// CLEAR EXPIRED SESSION
// =====================================================

function clearSavedSession() {

    localStorage.removeItem(
        "attendanceSession"
    );

    localStorage.removeItem(
        "sessionId"
    );

    currentSessionId = null;


    if (countdownInterval) {

        clearInterval(
            countdownInterval
        );

        countdownInterval = null;
    }


    const qrSection =
        document.getElementById("qrSection");

    if (qrSection) {

        qrSection.style.display =
            "none";
    }


    const qrImage =
        document.getElementById("qrImage");

    if (qrImage) {

        qrImage.removeAttribute("src");

        qrImage.style.display =
            "none";
    }
}


// =====================================================
// RESTORE PREVIOUS QR SESSION
// =====================================================

function restoreSession() {

    const session =
        getSavedSession();

    if (!session) {
        return;
    }

    showSavedQR(session);

    console.log(
        "QR session restored:",
        session.sessionId
    );
}


// =====================================================
// CREATE ATTENDANCE SESSION
// =====================================================

async function createSession() {

    const subjectInput =
        document.getElementById("subject");

    const durationInput =
        document.getElementById("duration");

    const generateButton =
        document.querySelector(
            'button[onclick="createSession()"]'
        );


    // ---------------------------------------------
    // Check HTML elements
    // ---------------------------------------------

    if (
        !subjectInput ||
        !durationInput
    ) {

        console.error(
            "Subject or duration input not found."
        );

        showToast(
            "Something is wrong with the Teacher Dashboard.",
            "error"
        );

        return;
    }


    const subject =
        subjectInput.value.trim();

    const duration =
        Number(durationInput.value);


    // ---------------------------------------------
    // Validate subject
    // ---------------------------------------------

    if (!subject) {

        showToast(
            "Please enter a subject.",
            "warning"
        );

        subjectInput.focus();

        return;
    }


    // ---------------------------------------------
    // Validate duration
    // ---------------------------------------------

    if (
        !duration ||
        duration < 1 ||
        duration > 60
    ) {

        showToast(
            "Duration must be between 1 and 60 minutes.",
            "warning"
        );

        durationInput.focus();

        return;
    }


    // ---------------------------------------------
    // Stop old countdown
    // ---------------------------------------------

    if (countdownInterval) {

        clearInterval(
            countdownInterval
        );

        countdownInterval = null;
    }


    // ---------------------------------------------
    // Disable button
    // ---------------------------------------------

    if (generateButton) {

        generateButton.disabled = true;

        generateButton.innerText =
            "Generating QR...";
    }


    try {

        // =========================================
        // CREATE SESSION REQUEST
        // =========================================

        const response =
            await fetch(
                "/api/session/create",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({

                        subject: subject,

                        duration: duration
                    })
                }
            );


        const data =
            await response.json();


        console.log(
            "Create session response:",
            response.status,
            data
        );


        // =========================================
        // SERVER ERROR
        // =========================================

        if (!response.ok) {

            showToast(
                data.message ||
                "Failed to create attendance session.",
                "error"
            );

            return;
        }


        // =========================================
        // CHECK SESSION ID
        // =========================================

        if (!data.sessionId) {

            showToast(
                "Session created but session ID was not received.",
                "error"
            );

            return;
        }


        // =========================================
        // SAVE SESSION ID
        // =========================================

        currentSessionId =
            data.sessionId;

        localStorage.setItem(
            "sessionId",
            data.sessionId
        );


        // =========================================
        // SAVE COMPLETE SESSION
        // =========================================

        const sessionData = {

            sessionId:
                data.sessionId,

            subject:
                data.subject || subject,

            qrCode:
                data.qrCode,

            expiryTime:
                data.expiryTime
        };


        localStorage.setItem(
            "attendanceSession",
            JSON.stringify(sessionData)
        );


        // =========================================
        // SHOW QR
        // =========================================

        showSavedQR(
            sessionData
        );


        // =========================================
        // SUCCESS
        // =========================================

        showToast(
            "Attendance session created successfully!",
            "success"
        );


    } catch (error) {

        console.error(
            "Create session error:",
            error
        );

        showToast(
            "Server error. Please try again.",
            "error"
        );


    } finally {

        if (generateButton) {

            generateButton.disabled =
                false;

            generateButton.innerText =
                "⚡ Generate QR";
        }
    }
}


// =====================================================
// QR COUNTDOWN
// =====================================================

function startCountdown(expiryTime) {

    // Stop previous timer

    if (countdownInterval) {

        clearInterval(
            countdownInterval
        );
    }


    const expiryElement =
        document.getElementById("expiry");

    if (!expiryElement) {
        return;
    }


    function updateCountdown() {

        const now =
            Date.now();

        const expiry =
            new Date(
                expiryTime
            ).getTime();

        const remaining =
            expiry - now;


        // =========================================
        // QR EXPIRED
        // =========================================

        if (remaining <= 0) {

            clearInterval(
                countdownInterval
            );

            countdownInterval =
                null;


            expiryElement.innerText =
                "🔴 QR EXPIRED";

            expiryElement.classList.remove(
                "warning",
                "danger"
            );

            expiryElement.classList.add(
                "expired"
            );


            // Remove saved QR

            localStorage.removeItem(
                "attendanceSession"
            );

            localStorage.removeItem(
                "sessionId"
            );


            currentSessionId = null;


            return;
        }


        // =========================================
        // CALCULATE TIME
        // =========================================

        const totalSeconds =
            Math.floor(
                remaining / 1000
            );

        const minutes =
            Math.floor(
                totalSeconds / 60
            );

        const seconds =
            totalSeconds % 60;


        expiryElement.innerText =
            `⏱️ ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


        // =========================================
        // TIMER COLORS
        // =========================================

        expiryElement.classList.remove(
            "warning",
            "danger",
            "expired"
        );


        if (
            totalSeconds <= 60
        ) {

            expiryElement.classList.add(
                "warning"
            );
        }


        if (
            totalSeconds <= 30
        ) {

            expiryElement.classList.remove(
                "warning"
            );

            expiryElement.classList.add(
                "danger"
            );
        }
    }


    // Run immediately

    updateCountdown();


    // Run every second

    countdownInterval =
        setInterval(
            updateCountdown,
            1000
        );
}


// =====================================================
// VIEW ATTENDANCE
// =====================================================

function viewAttendance() {

    const sessionId =
        localStorage.getItem(
            "sessionId"
        );


    if (!sessionId) {

        showToast(
            "No active attendance session.",
            "warning"
        );

        return;
    }


    window.location.href =
        `attendance.html?sessionId=${sessionId}`;
}


// =====================================================
// FIX CHROME BACK BUTTON / BF CACHE
// =====================================================

function resetPage() {

    document.body.classList.remove(
        "page-exit"
    );

    document.body.style.opacity =
        "";

    document.body.style.transform =
        "";
}


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        resetPage();

        restoreSession();
    }
);


// =====================================================
// CHROME BACK BUTTON
// =====================================================

window.addEventListener(
    "pageshow",
    () => {

        resetPage();

        /*
         * Always check localStorage again.
         *
         * This is important because Chrome can
         * restore the old page from memory.
         */

        setTimeout(() => {

            restoreSession();

        }, 50);
    }
);


// =====================================================
// PAGE VISIBILITY
// =====================================================

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            resetPage();

            restoreSession();
        }
    }
);


// =====================================================
// LOGOUT
// =====================================================

function logout() {

    if (countdownInterval) {

        clearInterval(
            countdownInterval
        );

        countdownInterval = null;
    }


    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "user"
    );

    localStorage.removeItem(
        "sessionId"
    );

    localStorage.removeItem(
        "attendanceSession"
    );


    window.location.href =
        "index.html";
}

