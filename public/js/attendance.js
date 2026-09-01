// =====================================================
// TEACHER AUTHENTICATION
// =====================================================

const attendanceToken = localStorage.getItem("token");

let attendanceUser = null;

try {

    attendanceUser =
        JSON.parse(
            localStorage.getItem("user")
        );

} catch (error) {

    console.error(
        "Invalid user data:",
        error
    );

}


// =====================================================
// CHECK TEACHER LOGIN
// =====================================================

if (
    !attendanceToken ||
    !attendanceUser ||
    attendanceUser.role !== "teacher"
) {

    localStorage.clear();

    window.location.href =
        "index.html";
}


// =====================================================
// GET SESSION ID
// =====================================================

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const sessionId =
    urlParams.get("sessionId");


console.log(
    "Attendance Session:",
    sessionId
);


// =====================================================
// VARIABLES
// =====================================================

let attendanceRecords = [];

let previousAttendanceCount = 0;

let autoRefreshInterval = null;


// =====================================================
// LOAD ATTENDANCE
// =====================================================

async function loadAttendance() {

    if (!sessionId) {

        console.error(
            "No session ID found."
        );

        return;
    }


    try {

        const response =
            await fetch(
                `/api/attendance/session/${sessionId}`,
                {

                    method: "GET",

                    headers: {

                        "Authorization":
                            `Bearer ${attendanceToken}`

                    }

                }
            );


        const data =
            await response.json();


        console.log(
            "Attendance response:",
            data
        );


        // =================================================
        // SERVER ERROR
        // =================================================

        if (!response.ok) {

            console.error(
                data.message ||
                "Failed to load attendance."
            );

            return;
        }


        // =================================================
        // STORE DATA
        // =================================================

        if (Array.isArray(data)) {

            attendanceRecords =
                data;

        } else if (
            data &&
            Array.isArray(data.attendance)
        ) {

            attendanceRecords =
                data.attendance;

        } else {

            attendanceRecords = [];

        }


        // =================================================
        // UPDATE UI
        // =================================================

        updateAttendanceStats();

        displayAttendance(
            attendanceRecords
        );


    } catch (error) {

        console.error(
            "Attendance loading error:",
            error
        );

    }

}


// =====================================================
// UPDATE STATISTICS
// =====================================================

function updateAttendanceStats() {

    const presentCount =
        attendanceRecords.length;


    // =================================================
    // PRESENT COUNT
    // =================================================

    const presentElement =
        document.getElementById(
            "presentCount"
        );


    if (presentElement) {

        animateNumber(
            presentElement,
            presentCount
        );

    }


    // =================================================
    // SESSION STATUS
    // =================================================

    const sessionStatus =
        document.getElementById(
            "sessionStatus"
        );


    if (sessionStatus) {

        sessionStatus.innerText =
            "Active";

    }


    // =================================================
    // ATTENDANCE PERCENTAGE
    // =================================================

    const percentageElement =
        document.getElementById(
            "attendancePercentage"
        );


    if (percentageElement) {

        /*
         * If your backend later sends:
         *
         * {
         *   attendance: [...],
         *   totalStudents: 50
         * }
         *
         * this will automatically calculate:
         *
         * 7 / 50 = 14%
         */

        let totalStudents = null;


        /*
         * Try to get total students
         * if available from API.
         */

        if (
            window.lastAttendanceResponse &&
            window.lastAttendanceResponse.totalStudents
        ) {

            totalStudents =
                Number(
                    window.lastAttendanceResponse.totalStudents
                );

        }


        if (
            totalStudents &&
            totalStudents > 0
        ) {

            const percentage =
                Math.round(
                    (
                        presentCount /
                        totalStudents
                    ) * 100
                );


            percentageElement.innerText =
                `${percentage}%`;

        } else {

            /*
             * We don't know total students
             * from the current backend.
             */

            percentageElement.innerText =
                "—";

        }

    }


    // =================================================
    // NEW ATTENDANCE DETECTION
    // =================================================

    if (
        presentCount >
        previousAttendanceCount
    ) {

        if (
            previousAttendanceCount !== 0
        ) {

            showNewAttendanceNotification();

        }

    }


    previousAttendanceCount =
        presentCount;

}


// =====================================================
// DISPLAY ATTENDANCE
// =====================================================

function displayAttendance(records) {

    const table =
        document.getElementById(
            "attendanceTable"
        );


    if (!table) {

        console.error(
            "attendanceTable not found."
        );

        return;
    }


    // =================================================
    // EMPTY
    // =================================================

    if (
        !records ||
        records.length === 0
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="loading-cell"
                >

                    👨‍🎓

                    <br>

                    No attendance marked yet.

                </td>

            </tr>

        `;

        return;
    }


    // =================================================
    // DISPLAY ROWS
    // =================================================

    table.innerHTML = "";


    records.forEach(
        (record, index) => {

            const row =
                document.createElement(
                    "tr"
                );


            // New record animation

            if (
                index ===
                records.length - 1
            ) {

                row.classList.add(
                    "new-attendance-row"
                );

            }


            const student =
                record.studentId ||
                {};


            const rollNumber =
                student.rollNumber ||
                "-";


            const name =
                student.name ||
                "-";


            const email =
                student.email ||
                "-";


            const markedAt =
                record.markedAt
                    ? new Date(
                        record.markedAt
                    ).toLocaleTimeString()
                    : "-";


            const status =
                record.status ||
                "Present";


            row.innerHTML = `

                <td>

                    <strong>
                        ${escapeHTML(
                            rollNumber
                        )}
                    </strong>

                </td>


                <td>

                    <div class="student-name-cell">

                        <div class="student-avatar">

                            ${getInitials(name)}

                        </div>

                        <span>

                            ${escapeHTML(name)}

                        </span>

                    </div>

                </td>


                <td>

                    ${escapeHTML(email)}

                </td>


                <td>

                    ${markedAt}

                </td>


                <td>

                    <span class="present-badge">

                        ● ${escapeHTML(status)}

                    </span>

                </td>

            `;


            table.appendChild(
                row
            );

        }
    );

}


// =====================================================
// SEARCH ATTENDANCE
// =====================================================

function searchAttendance() {

    const searchInput =
        document.getElementById(
            "attendanceSearch"
        );


    if (!searchInput) {
        return;
    }


    const search =
        searchInput.value
            .toLowerCase()
            .trim();


    if (!search) {

        displayAttendance(
            attendanceRecords
        );

        return;
    }


    const filtered =
        attendanceRecords.filter(
            record => {

                const student =
                    record.studentId ||
                    {};


                const roll =
                    String(
                        student.rollNumber ||
                        ""
                    ).toLowerCase();


                const name =
                    String(
                        student.name ||
                        ""
                    ).toLowerCase();


                const email =
                    String(
                        student.email ||
                        ""
                    ).toLowerCase();


                return (
                    roll.includes(search) ||
                    name.includes(search) ||
                    email.includes(search)
                );

            }
        );


    displayAttendance(
        filtered
    );

}


// =====================================================
// CLEAR SEARCH
// =====================================================

function clearAttendanceSearch() {

    const input =
        document.getElementById(
            "attendanceSearch"
        );


    if (input) {

        input.value = "";

    }


    displayAttendance(
        attendanceRecords
    );

}


// =====================================================
// EXPORT CSV
// =====================================================

function exportAttendanceCSV() {

    if (
        !attendanceRecords ||
        attendanceRecords.length === 0
    ) {

        showToast(
            "There is no attendance to export.",
            "warning"
        );

        return;
    }


    let csv =
        "Roll Number,Student Name,Email,Marked At,Status\n";


    attendanceRecords.forEach(
        record => {

            const student =
                record.studentId ||
                {};


            const roll =
                student.rollNumber ||
                "";


            const name =
                student.name ||
                "";


            const email =
                student.email ||
                "";


            const markedAt =
                record.markedAt
                    ? new Date(
                        record.markedAt
                    ).toLocaleString()
                    : "";


            const status =
                record.status ||
                "Present";


            csv +=
                `"${csvEscape(roll)}",` +
                `"${csvEscape(name)}",` +
                `"${csvEscape(email)}",` +
                `"${csvEscape(markedAt)}",` +
                `"${csvEscape(status)}"\n`;

        }
    );


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        `attendance-${sessionId}.csv`;


    document.body.appendChild(
        link
    );


    link.click();


    document.body.removeChild(
        link
    );


    URL.revokeObjectURL(
        url
    );


    showToast(
        "Attendance CSV exported successfully.",
        "success"
    );

}


// =====================================================
// CSV ESCAPE
// =====================================================

function csvEscape(value) {

    return String(
        value
    )
        .replace(
            /"/g,
            '""'
        );

}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHTML(value) {

    return String(
        value
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// STUDENT INITIALS
// =====================================================

function getInitials(name) {

    if (
        !name ||
        name === "-"
    ) {

        return "?";

    }


    const parts =
        name.trim().split(
            /\s+/
        );


    if (
        parts.length === 1
    ) {

        return parts[0]
            .substring(0, 2)
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();

}


// =====================================================
// NUMBER ANIMATION
// =====================================================

function animateNumber(
    element,
    target
) {

    const start =
        Number(
            element.dataset.value ||
            0
        );


    if (
        start === target
    ) {

        element.innerText =
            target;

        return;

    }


    const duration =
        500;


    const startTime =
        performance.now();


    function update(currentTime) {

        const progress =
            Math.min(
                (
                    currentTime -
                    startTime
                ) / duration,
                1
            );


        const value =
            Math.floor(
                start +
                (
                    target -
                    start
                ) *
                progress
            );


        element.innerText =
            value;


        if (
            progress < 1
        ) {

            requestAnimationFrame(
                update
            );

        }

    }


    requestAnimationFrame(
        update
    );


    element.dataset.value =
        target;

}


// =====================================================
// NEW ATTENDANCE NOTIFICATION
// =====================================================

function showNewAttendanceNotification() {

    const card =
        document.querySelector(
            ".attendance-card"
        );


    if (!card) {
        return;
    }


    card.classList.remove(
        "new-attendance"
    );


    void card.offsetWidth;


    card.classList.add(
        "new-attendance"
    );


    setTimeout(
        () => {

            card.classList.remove(
                "new-attendance"
            );

        },
        1000
    );


    if (
        typeof showToast ===
        "function"
    ) {

        showToast(
            "New attendance marked! 🎉",
            "success"
        );

    }

}


// =====================================================
// AUTO REFRESH
// =====================================================

function startAutoRefresh() {

    if (
        autoRefreshInterval
    ) {

        clearInterval(
            autoRefreshInterval
        );

    }


    autoRefreshInterval =
        setInterval(
            () => {

                loadAttendance();

            },
            5000
        );

}


// =====================================================
// STOP AUTO REFRESH
// =====================================================

function stopAutoRefresh() {

    if (
        autoRefreshInterval
    ) {

        clearInterval(
            autoRefreshInterval
        );

        autoRefreshInterval =
            null;

    }

}


// =====================================================
// BACK TO DASHBOARD
// =====================================================

function goBack() {

    stopAutoRefresh();

    window.location.href =
        "teacher.html";

}


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadAttendance();

        startAutoRefresh();

    }
);


// =====================================================
// STOP WHEN LEAVING PAGE
// =====================================================

window.addEventListener(
    "beforeunload",
    () => {

        stopAutoRefresh();

    }
);