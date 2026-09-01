const express = require("express");
const crypto = require("crypto");
const QRCode = require("qrcode");

const Attendance =
    require("../models/Attendance");

const Session =
    require("../models/Session");

const {
    authenticate,
    studentOnly,
    teacherOnly
} = require("../middleware/auth");

const router = express.Router();


// =====================================================
// MARK ATTENDANCE
// =====================================================

router.post(
    "/mark",
    authenticate,
    studentOnly,
    async (req, res) => {

        try {

            const {
                sessionId,
                token
            } = req.body;


            // =================================================
            // VALIDATE QR DATA
            // =================================================

            if (!sessionId || !token) {

                return res.status(400).json({
                    message: "Invalid QR data"
                });

            }


            // =================================================
            // FIND SESSION
            // =================================================

            const session =
                await Session.findById(sessionId);


            if (!session) {

                return res.status(404).json({
                    message: "Session not found"
                });

            }


            // =================================================
            // CHECK SESSION ACTIVE
            // =================================================

            if (!session.active) {

                return res.status(400).json({
                    message:
                        "Attendance session is closed"
                });

            }


            // =================================================
            // CHECK EXPIRY
            // =================================================

            const currentTime =
                new Date();


            if (
                currentTime >
                session.expiryTime
            ) {

                return res.status(400).json({
                    message:
                        "QR code has expired"
                });

            }


            // =================================================
            // CHECK CURRENT QR TOKEN
            // =================================================

            if (
                session.sessionToken !== token
            ) {

                return res.status(400).json({
                    message:
                        "QR code is no longer valid"
                });

            }


            // =================================================
            // CHECK IF STUDENT ALREADY ATTENDED
            // =================================================

            const alreadyMarked =
                await Attendance.findOne({

                    studentId:
                        req.user.id,

                    sessionId:
                        session._id

                });


            if (alreadyMarked) {

                return res.status(400).json({
                    message:
                        "Attendance already marked"
                });

            }


            // =================================================
            // CREATE ATTENDANCE
            // =================================================

            const attendance =
                new Attendance({

                    studentId:
                        req.user.id,

                    sessionId:
                        session._id,

                    markedAt:
                        currentTime,

                    status:
                        "Present"

                });


            await attendance.save();

// =====================================================
// ATTENDANCE SUCCESS
// =====================================================

return res.status(201).json({

    message:
        "Attendance marked successfully",

    sessionId:
        session._id,

    subject:
        session.subject,

    expiryTime:
        session.expiryTime

});



        } catch (error) {

            console.error(
                "Mark Attendance Error:",
                error
            );


            // Duplicate attendance
            if (
                error.code === 11000
            ) {

                return res.status(400).json({

                    message:
                        "Attendance already marked"

                });

            }


            return res.status(500).json({

                message:
                    "Failed to mark attendance"

            });

        }

    }
);


// =====================================================
// GET ATTENDANCE FOR TEACHER
// =====================================================

router.get(
    "/session/:sessionId",
    authenticate,
    teacherOnly,
    async (req, res) => {

        try {

            const attendance =
                await Attendance.find({

                    sessionId:
                        req.params.sessionId

                })
                .populate(
                    "studentId",
                    "name email rollNumber"
                )
                .sort({
                    markedAt: 1
                });


            return res.json(
                attendance
            );


        } catch (error) {

            console.error(
                "Attendance loading error:",
                error
            );


            return res.status(500).json({

                message:
                    "Failed to fetch attendance"

            });

        }

    }
);


// =====================================================
// GET ATTENDANCE SUMMARY
// =====================================================

router.get(
    "/session/:sessionId/summary",
    authenticate,
    teacherOnly,
    async (req, res) => {

        try {

            const attendance =
                await Attendance.find({

                    sessionId:
                        req.params.sessionId

                })
                .populate(
                    "studentId",
                    "name email rollNumber"
                )
                .sort({
                    markedAt: 1
                });


            const present =
                attendance.filter(
                    record =>
                        record.status === "Present"
                ).length;


            const totalStudents =
                attendance.length;


            const absent = 0;


            const percentage =
                totalStudents === 0
                    ? 0
                    : Math.round(
                        (present /
                            totalStudents) *
                        100
                    );


            const students =
                attendance.map(
                    record => ({

                        name:
                            record.studentId.name,

                        email:
                            record.studentId.email,

                        rollNumber:
                            record.studentId.rollNumber,

                        status:
                            record.status,

                        markedAt:
                            record.markedAt

                    })
                );


            return res.json({

                totalStudents,

                present,

                absent,

                percentage,

                students

            });


        } catch (error) {

            console.error(
                "Attendance Summary Error:",
                error
            );


            return res.status(500).json({

                message:
                    "Failed to load attendance"

            });

        }

    }
);


module.exports = router;