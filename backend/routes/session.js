const express = require("express");
const crypto = require("crypto");
const QRCode = require("qrcode");

const Session =
    require("../models/Session");

const {
    authenticate,
    teacherOnly
} = require("../middleware/auth");

const router = express.Router();


// =====================================================
// CREATE ATTENDANCE SESSION
// =====================================================

router.post(
    "/create",
    authenticate,
    teacherOnly,
    async (req, res) => {

        try {

            const {
                subject,
                duration
            } = req.body;


            if (!subject) {

                return res.status(400).json({

                    message:
                        "Subject is required"

                });

            }


            const startTime =
                new Date();


            const durationInMinutes =
                Number(duration) || 2;


            const expiryTime =
                new Date(
                    startTime.getTime() +
                    durationInMinutes *
                    60 *
                    1000
                );


            const sessionToken =
                crypto.randomBytes(32)
                    .toString("hex");


            const session =
                new Session({

                    subject,

                    teacherId:
                        req.user.id,

                    sessionToken,

                    startTime,

                    expiryTime,

                    active: true

                });


            await session.save();


            const qrData =
                JSON.stringify({

                    sessionId:
                        session._id,

                    token:
                        sessionToken

                });


            const qrCode =
                await QRCode.toDataURL(
                    qrData
                );


            return res.status(201).json({

                message:
                    "Attendance session created",

                sessionId:
                    session._id,

                subject,

                startTime,

                expiryTime,

                qrCode

            });


        } catch (error) {

            console.error(
                "Create Session Error:",
                error
            );


            return res.status(500).json({

                message:
                    "Failed to create session"

            });

        }

    }
);


// =====================================================
// GET ALL TEACHER SESSIONS
// =====================================================

router.get(
    "/",
    authenticate,
    teacherOnly,
    async (req, res) => {

        try {

            const sessions =
                await Session.find({

                    teacherId:
                        req.user.id

                })
                .sort({
                    createdAt: -1
                });


            return res.json(
                sessions
            );


        } catch (error) {

            console.error(error);


            return res.status(500).json({

                message:
                    "Failed to fetch sessions"

            });

        }

    }
);


// =====================================================
// GET CURRENT QR FOR A SESSION
// =====================================================

router.get(
    "/:sessionId",
    authenticate,
    teacherOnly,
    async (req, res) => {

        try {

            const session =
                await Session.findOne({

                    _id:
                        req.params.sessionId,

                    teacherId:
                        req.user.id

                });


            if (!session) {

                return res.status(404).json({

                    message:
                        "Session not found"

                });

            }


            // =================================================
            // CHECK EXPIRY
            // =================================================

            const now =
                new Date();


            if (
                now >
                session.expiryTime
            ) {

                if (session.active) {

                    session.active =
                        false;

                    await session.save();

                }


                return res.json({

                    active: false,

                    expired: true,

                    sessionId:
                        session._id,

                    subject:
                        session.subject,

                    expiryTime:
                        session.expiryTime

                });

            }


            // =================================================
            // GENERATE CURRENT QR
            // =================================================

            const qrData =
                JSON.stringify({

                    sessionId:
                        session._id,

                    token:
                        session.sessionToken

                });


            const qrCode =
                await QRCode.toDataURL(
                    qrData
                );


            return res.json({

                active:
                    session.active,

                expired:
                    false,

                sessionId:
                    session._id,

                subject:
                    session.subject,

                startTime:
                    session.startTime,

                expiryTime:
                    session.expiryTime,

                qrCode

            });


        } catch (error) {

            console.error(
                "Get Session Error:",
                error
            );


            return res.status(500).json({

                message:
                    "Failed to fetch session"

            });

        }

    }
);


module.exports = router;