const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const QRCode = require("qrcode");
const Session = require("../models/Session");
const { authenticate, teacherOnly } = require("../middleware/auth");

const router = express.Router();

function getQrToken(session, slot) {
    return crypto
        .createHmac("sha256", session.qrSecret)
        .update(`${session._id.toString()}:${slot}`)
        .digest("hex");
}

function getSlot(session, now = Date.now()) {
    return Math.floor((now - session.startTime.getTime()) / (session.qrIntervalSec * 1000));
}

async function buildQr(session, now = Date.now()) {
    const slot = Math.max(0, getSlot(session, now));
    const token = getQrToken(session, slot);
    const payload = JSON.stringify({ v: 2, sessionId: session._id.toString(), slot, token });
    return {
        qrCode: await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 360 }),
        slot,
        token
    };
}

router.post("/create", authenticate, teacherOnly, async (req, res) => {
    try {
        const subject = String(req.body.subject || "").trim();
        const duration = Number(req.body.duration);
        const qrIntervalSec = Math.min(60, Math.max(5, Number(req.body.qrIntervalSec) || 10));
        const radiusMeters = Math.min(1000, Math.max(10, Number(req.body.radiusMeters) || 100));
        const location = req.body.classroomLocation;
        const hasLocation = location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));

        if (!subject) return res.status(400).json({ message: "Subject is required" });
        if (!Number.isFinite(duration) || duration < 1 || duration > 180) return res.status(400).json({ message: "Duration must be between 1 and 180 minutes" });
        if (hasLocation && (Number(location.lat) < -90 || Number(location.lat) > 90 || Number(location.lng) < -180 || Number(location.lng) > 180)) {
            return res.status(400).json({ message: "Invalid classroom coordinates" });
        }

        // Close any older active sessions for this teacher.
        await Session.updateMany({ teacherId: req.user.id, active: true }, { $set: { active: false } });

        const startTime = new Date();
        const expiryTime = new Date(startTime.getTime() + duration * 60 * 1000);
        const session = await Session.create({
            subject,
            teacherId: req.user.id,
            qrSecret: crypto.randomBytes(32).toString("hex"),
            qrIntervalSec,
            startTime,
            expiryTime,
            active: true,
            requireLocation: Boolean(hasLocation),
            requireDeviceBinding: req.body.requireDeviceBinding !== false,
            classroomLocation: hasLocation ? {
                lat: Number(location.lat),
                lng: Number(location.lng),
                radiusMeters
            } : undefined
        });

        const qr = await buildQr(session);
        return res.status(201).json({
            message: "Attendance session created",
            sessionId: session._id,
            subject: session.subject,
            startTime,
            expiryTime,
            qrIntervalSec,
            requireLocation: session.requireLocation,
            requireDeviceBinding: session.requireDeviceBinding,
            classroomLocation: session.classroomLocation || null,
            qrCode: qr.qrCode,
            qrSlot: qr.slot
        });
    } catch (error) {
        console.error("Create Session Error:", error);
        return res.status(500).json({ message: "Failed to create attendance session" });
    }
});

router.get("/", authenticate, teacherOnly, async (req, res) => {
    try {
        const sessions = await Session.find({ teacherId: req.user.id }).sort({ createdAt: -1 }).limit(50).select("subject startTime expiryTime active qrIntervalSec requireLocation classroomLocation createdAt");
        return res.json(sessions);
    } catch (error) {
        console.error("Session list error:", error);
        return res.status(500).json({ message: "Failed to fetch sessions" });
    }
});

router.get("/:sessionId", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.sessionId)) return res.status(400).json({ message: "Invalid session ID" });
        const session = await Session.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });
        if (req.user.role === "teacher" && session.teacherId.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });

        // Backward compatibility: upgrade sessions created by v1 on first access.
        if (!session.qrSecret) {
            session.qrSecret = crypto.randomBytes(32).toString("hex");
            if (!session.qrIntervalSec) session.qrIntervalSec = 10;
            await session.save();
        }

        const now = new Date();
        if (now >= session.expiryTime && session.active) {
            session.active = false;
            await session.save();
        }

        const active = session.active && now < session.expiryTime;
        const qr = active ? await buildQr(session, now.getTime()) : null;
        return res.json({
            active,
            expired: !active,
            sessionId: session._id,
            subject: session.subject,
            startTime: session.startTime,
            expiryTime: session.expiryTime,
            qrIntervalSec: session.qrIntervalSec,
            requireLocation: session.requireLocation,
            requireDeviceBinding: session.requireDeviceBinding,
            classroomLocation: session.classroomLocation || null,
            qrCode: qr ? qr.qrCode : null,
            qrSlot: qr ? qr.slot : null
        });
    } catch (error) {
        console.error("Get Session Error:", error);
        return res.status(500).json({ message: "Failed to fetch session" });
    }
});

router.post("/:sessionId/close", authenticate, teacherOnly, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.sessionId)) return res.status(400).json({ message: "Invalid session ID" });
        const session = await Session.findOneAndUpdate({ _id: req.params.sessionId, teacherId: req.user.id }, { $set: { active: false } }, { new: true });
        if (!session) return res.status(404).json({ message: "Session not found" });
        return res.json({ message: "Session closed", active: false });
    } catch (error) {
        console.error("Close Session Error:", error);
        return res.status(500).json({ message: "Failed to close session" });
    }
});

module.exports = { router, getQrToken, getSlot };
