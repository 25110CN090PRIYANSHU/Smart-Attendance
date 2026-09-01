// =====================================================
// STUDENT AUTHENTICATION
// =====================================================

const scanToken = localStorage.getItem("token");

let scanUser = null;

try {
    scanUser = JSON.parse(
        localStorage.getItem("user")
    );
} catch (error) {
    console.error("Invalid user data:", error);
}


// =====================================================
// CHECK LOGIN
// =====================================================

if (
    !scanToken ||
    !scanUser ||
    scanUser.role !== "student"
) {
    localStorage.clear();
    window.location.href = "index.html";
}


// =====================================================
// SCANNER VARIABLES
// =====================================================

let scanner = null;
let scannerRunning = false;
let processingScan = false;


// =====================================================
// START SCANNER
// =====================================================

async function startScanner() {

    console.log("Starting QR scanner...");

    const reader =
        document.getElementById("reader");

    if (!reader) {

        console.error(
            "ERROR: #reader element not found."
        );

        return;
    }


    // Prevent duplicate scanner instances

    if (scannerRunning) {

        console.log(
            "Scanner is already running."
        );

        return;
    }


    // Clear old scanner

    reader.innerHTML = "";


    // =================================================
    // CREATE SCANNER
    // =================================================

    try {

        scanner =
            new Html5Qrcode("reader");

    } catch (error) {

        console.error(
            "Failed to create scanner:",
            error
        );

        showScanError(
            "QR scanner could not be created."
        );

        return;
    }


    // =================================================
    // SCANNER CONFIG
    // =================================================

    const config = {

        fps: 15,

        qrbox: function (
            viewfinderWidth,
            viewfinderHeight
        ) {

            const size =
                Math.min(
                    viewfinderWidth,
                    viewfinderHeight
                ) * 0.70;

            return {
                width: Math.floor(size),
                height: Math.floor(size)
            };

        },

        aspectRatio: 1.0,

        disableFlip: false

    };


    // =================================================
    // GET AVAILABLE CAMERAS
    // =================================================

    let cameras;

    try {

        cameras =
            await Html5Qrcode.getCameras();

        console.log(
            "Available cameras:",
            cameras
        );

    } catch (error) {

        console.error(
            "Camera detection failed:",
            error
        );

        showScanError(
            "Unable to access your camera. Please allow camera permission."
        );

        return;
    }


    if (
        !cameras ||
        cameras.length === 0
    ) {

        console.error(
            "No cameras found."
        );

        showScanError(
            "No camera was found on this device."
        );

        return;
    }


    // =================================================
    // SELECT CAMERA
    // =================================================

    let selectedCamera =
        cameras[0];


    // Prefer back/environment camera

    const backCamera =
        cameras.find(
            camera =>
                /back|rear|environment/i.test(
                    camera.label
                )
        );


    if (backCamera) {

        selectedCamera =
            backCamera;

    }


    console.log(
        "Selected camera:",
        selectedCamera
    );


    // =================================================
    // START CAMERA
    // =================================================

    try {

        await scanner.start(

            selectedCamera.id,

            config,


            // =========================================
            // QR DETECTED
            // =========================================

            async (decodedText) => {

                console.log(
                    "================================="
                );

                console.log(
                    "QR DETECTED!"
                );

                console.log(
                    "QR CONTENT:",
                    decodedText
                );

                console.log(
                    "================================="
                );


                await onScanSuccess(
                    decodedText
                );

            },


            // =========================================
            // QR NOT DETECTED
            // =========================================

            (errorMessage) => {

                // This runs many times per second.
                // Do NOT print it continuously.

            }

        );


        scannerRunning = true;

        processingScan = false;


        console.log(
            "QR scanner started successfully."
        );


        updateScannerStatus(
            "Scanning for QR code...",
            "Keep the QR code inside the scanning area."
        );


    } catch (error) {

        console.error(
            "Unable to start camera:",
            error
        );

        scannerRunning = false;


        showScanError(
            "Unable to start camera. Please check camera permission."
        );

    }

}


// =====================================================
// QR SUCCESS
// =====================================================

async function onScanSuccess(
    decodedText
) {

    if (processingScan) {

        console.log(
            "Already processing QR..."
        );

        return;
    }


    processingScan = true;


    console.log(
        "Processing scanned QR..."
    );


    // =================================================
    // PARSE QR
    // =================================================

    let qrData;

    try {

        qrData =
            JSON.parse(decodedText);

    } catch (error) {

        console.error(
            "Invalid QR JSON:",
            decodedText
        );

        processingScan = false;

        showScanError(
            "This is not a valid attendance QR."
        );

        return;
    }


    console.log(
        "Parsed QR data:",
        qrData
    );


    // =================================================
    // VALIDATE QR
    // =================================================

    if (
        !qrData.sessionId ||
        !qrData.token
    ) {

        console.error(
            "Missing sessionId or token:",
            qrData
        );

        processingScan = false;

        showScanError(
            "Invalid attendance QR code."
        );

        return;
    }


    // =================================================
    // STOP CAMERA
    // =================================================

    await stopScanner();


    updateScannerStatus(
        "QR code detected!",
        "Sending attendance to the server..."
    );


    // =================================================
    // SHOW PROCESSING
    // =================================================

    const result =
        document.getElementById("result");


    if (result) {

        result.innerHTML = `

            <div class="scan-processing">

                ⏳ Marking attendance...

            </div>

        `;

    }


    console.log(
        "Sending attendance request..."
    );


    // =================================================
    // SEND TO BACKEND
    // =================================================

    try {

        const response =
            await fetch(
                "/api/attendance/mark",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${scanToken}`

                    },

                    body: JSON.stringify({

                        sessionId:
                            qrData.sessionId,

                        token:
                            qrData.token

                    })

                }
            );


        console.log(
            "Attendance API status:",
            response.status
        );


        let data = {};

        try {

            data =
                await response.json();

        } catch (error) {

            console.error(
                "Could not read server response."
            );

        }


        console.log(
            "Attendance API response:",
            data
        );


        // =================================================
        // SERVER ERROR
        // =================================================

        if (!response.ok) {

            processingScan = false;


            showScanError(

                data.message ||
                "Attendance could not be marked."

            );


            console.error(
                "Attendance failed:",
                data
            );


            // Restart scanner

            setTimeout(
                () => {

                    startScanner();

                },
                1500
            );


            return;
        }


        // =================================================
        // SUCCESS
        // =================================================

        console.log(
            "ATTENDANCE SUCCESS!"
        );


        showSuccessScreen(

            data.message ||
            "Attendance marked successfully!"

        );

    }


    // =================================================
    // NETWORK ERROR
    // =================================================

    catch (error) {

        console.error(
            "Attendance request failed:",
            error
        );


        processingScan = false;


        showScanError(
            "Server error. Please try again."
        );


        setTimeout(
            () => {

                startScanner();

            },
            1500
        );

    }

}


// =====================================================
// STOP SCANNER
// =====================================================

async function stopScanner() {

    if (
        scanner &&
        scannerRunning
    ) {

        try {

            await scanner.stop();

            console.log(
                "Camera stopped."
            );

        } catch (error) {

            console.error(
                "Camera stop error:",
                error
            );

        }

        scannerRunning = false;
    }

}


// =====================================================
// SUCCESS SCREEN
// =====================================================

function showSuccessScreen(
    message
) {

    const reader =
        document.getElementById(
            "reader"
        );


    const result =
        document.getElementById(
            "result"
        );


    // =================================================
    // SUCCESS ANIMATION
    // =================================================

    if (reader) {

        reader.innerHTML = `

            <div class="success-animation">

                <div class="success-circle">

                    <svg
                        class="success-check"
                        viewBox="0 0 52 52"
                    >

                        <circle
                            class="success-circle-bg"
                            cx="26"
                            cy="26"
                            r="25"
                            fill="none"
                        ></circle>

                        <path
                            class="success-check-path"
                            fill="none"
                            d="M14 27l8 8 16-18"
                        ></path>

                    </svg>

                </div>


                <h2>
                    Attendance Marked!
                </h2>


                <p>
                    ${message}
                </p>

            </div>

        `;


        reader.classList.add(
            "attendance-success-area"
        );

    }


    // =================================================
    // RESULT
    // =================================================

    if (result) {

        result.innerHTML = `

            <div class="success-message">

                ✓ Attendance successfully recorded

            </div>

        `;

        result.classList.add(
            "success-result"
        );

    }


    updateScannerStatus(
        "Attendance marked successfully!",
        "Your attendance has been recorded."
    );

}


// =====================================================
// ERROR
// =====================================================

function showScanError(
    message
) {

    const result =
        document.getElementById(
            "result"
        );


    if (!result) {

        return;
    }


    result.innerHTML = `

        <div class="error-message">

            ❌ ${message}

        </div>

    `;

}


// =====================================================
// UPDATE STATUS
// =====================================================

function updateScannerStatus(
    title,
    description
) {

    const statusTitle =
        document.querySelector(
            ".scan-status strong"
        );


    const statusDescription =
        document.querySelector(
            ".scan-status p"
        );


    if (statusTitle) {

        statusTitle.innerText =
            title;

    }


    if (statusDescription) {

        statusDescription.innerText =
            description;

    }

}


// =====================================================
// BACK BUTTON
// =====================================================

async function goBack() {

    await stopScanner();

    navigateBack();

}


// =====================================================
// NAVIGATE BACK
// =====================================================

function navigateBack() {

    document.body.classList.add(
        "page-exit"
    );


    setTimeout(
        () => {

            window.location.href =
                "student.html";

        },
        300
    );

}


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Scanner page loaded."
        );


        // Small delay gives html5-qrcode
        // and page layout time to initialize.

        setTimeout(
            () => {

                startScanner();

            },
            300
        );

    }
);


// =====================================================
// PAGE EXIT
// =====================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (
            scanner &&
            scannerRunning
        ) {

            scanner.stop()
                .catch(
                    () => {}
                );

        }

    }
);