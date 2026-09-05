const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Attendance = require("../models/Attendance");
const Session = require("../models/Session");
const User = require("../models/User");
const { authenticate, studentOnly, teacherOnly } = require("../middleware/auth");
const { getQrToken, getSlot } = require("./session");

const router = express.Router();

const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const toRad = value => value * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function hashDevice(deviceId) {
    const secret = process.env.DEVICE_HASH_SECRET || process.env.JWT_SECRET || "development-device-secret";
    return crypto.createHmac("sha256", secret).update(String(deviceId)).digest("hex");
}

function calculateRisk({ locationOk, deviceOk, accuracy, distance, qrOk }) {
    let score = 0;
    const flags = [];
    if (!qrOk) { score += 100; flags.push("QR verification failed"); }
    if (!locationOk) { score += 55; flags.push("Outside classroom geofence"); }
    if (Number.isFinite(accuracy) && accuracy > 100) { score += 15; flags.push("Low GPS accuracy"); }
    if (Number.isFinite(distance) && distance > 0) score += Math.min(20, Math.round(distance / 25));
    if (!deviceOk) { score += 45; flags.push("New or untrusted device"); }
    return { score: Math.min(100, score), flags };
}

router.post("/mark", authenticate, studentOnly, async (req, res) => {
    try {
        if (req.body.sessionId && !mongoose.isValidObjectId(req.body.sessionId)) return res.status(400).json({ message: "Invalid session ID" });
        const { sessionId, token, slot, deviceId, location } = req.body;
        if (!sessionId || !token || !Number.isInteger(Number(slot))) return res.status(400).json({ message: "Invalid attendance QR data" });
        if (!deviceId || String(deviceId).length < 16 || String(deviceId).length > 200) return res.status(400).json({ message: "Secure device identification is required" });

        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Attendance session not found" });
        if (!session.active) return res.status(400).json({ message: "Attendance session is closed" });

        const now = new Date();
        if (now >= session.expiryTime) {
            session.active = false;
            await session.save();
            return res.status(400).json({ message: "Attendance session has expired" });
        }

        const currentSlot = getSlot(session, now.getTime());
        const scannedSlot = Number(slot);
        // Allow the immediately previous QR for a short period so a scan during rotation isn't unfairly rejected.
        const slotValid = scannedSlot === currentSlot || (scannedSlot === currentSlot - 1 && (now.getTime() - session.startTime.getTime()) % (session.qrIntervalSec * 1000) <= 2500);
        const expectedToken = getQrToken(session, scannedSlot);
        const providedToken = Buffer.from(String(token));
        const expectedTokenBuffer = Buffer.from(expectedToken);
        const qrOk = slotValid && providedToken.length === expectedTokenBuffer.length && crypto.timingSafeEqual(providedToken, expectedTokenBuffer);
        if (!qrOk) return res.status(400).json({ message: "QR code is expired or invalid. Scan the current QR." });

        const duplicate = await Attendance.findOne({ studentId: req.user.id, sessionId: session._id });
        if (duplicate) return res.status(409).json({ message: "Attendance already marked for this session", attendance: duplicate });

        const student = await User.findById(req.user.id);
        if (!student) return res.status(401).json({ message: "Student account not found" });

        const submittedDeviceHash = hashDevice(deviceId);
        let deviceOk = true;

        let distance = null;
        let accuracy = null;
        let locationOk = !session.requireLocation;
        let cleanLocation = null;

        if (location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))) {
            accuracy = Number(location.accuracy);
            cleanLocation = { lat: Number(location.lat), lng: Number(location.lng), accuracyMeters: Number.isFinite(accuracy) ? accuracy : undefined };
        }

        if (session.requireLocation) {
            if (!cleanLocation) return res.status(400).json({ message: "Location permission is required for this classroom session" });
            distance = haversineMeters(session.classroomLocation.lat, session.classroomLocation.lng, cleanLocation.lat, cleanLocation.lng);
            locationOk = distance <= session.classroomLocation.radiusMeters && (!Number.isFinite(accuracy) || accuracy <= 150);
            cleanLocation.distanceMeters = Math.round(distance);
            if (!locationOk) return res.status(403).json({ message: `You are outside the allowed classroom area (${Math.round(distance)}m away).`, distanceMeters: Math.round(distance), radiusMeters: session.classroomLocation.radiusMeters });
        }

        if (session.requireDeviceBinding) {
            if (!student.deviceIdHash) {
                student.deviceIdHash = submittedDeviceHash;
                student.deviceBoundAt = now;
                await student.save();
            } else {
                deviceOk = student.deviceIdHash === submittedDeviceHash;
            }
        }

        const risk = calculateRisk({ locationOk, deviceOk, accuracy, distance, qrOk });
        const status = deviceOk ? "Present" : "Flagged";

        const attendance = await Attendance.create({
            studentId: req.user.id,
            sessionId: session._id,
            markedAt: now,
            status,
            verification: { qr: qrOk, location: locationOk, device: deviceOk },
            location: cleanLocation || undefined,
            deviceIdHash: submittedDeviceHash,
            riskScore: risk.score,
            riskFlags: risk.flags
        });

        return res.status(201).json({
            message: status === "Present" ? "Attendance marked successfully" : "Attendance recorded and flagged for teacher review",
            attendance: { id: attendance._id, status, riskScore: risk.score, riskFlags: risk.flags, distanceMeters: cleanLocation?.distanceMeters ?? null },
            subject: session.subject,
            markedAt: now,
            verified: { qr: qrOk, location: locationOk, device: deviceOk }
        });
    } catch (error) {
        console.error("Mark Attendance Error:", error);
        if (error.code === 11000) return res.status(409).json({ message: "Attendance already marked for this session" });
        return res.status(500).json({ message: "Failed to mark attendance" });
    }
});

router.get("/session/:sessionId", authenticate, teacherOnly, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.sessionId)) return res.status(400).json({ message: "Invalid session ID" });
        const session = await Session.findOne({ _id: req.params.sessionId, teacherId: req.user.id });
        if (!session) return res.status(404).json({ message: "Session not found" });
        const attendance = await Attendance.find({ sessionId: session._id }).populate("studentId", "name email rollNumber").sort({ markedAt: 1 });
        return res.json(attendance);
    } catch (error) {
        console.error("Attendance loading error:", error);
        return res.status(500).json({ message: "Failed to fetch attendance" });
    }
});

router.get("/session/:sessionId/summary", authenticate, teacherOnly, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.sessionId)) return res.status(400).json({ message: "Invalid session ID" });
        const session = await Session.findOne({ _id: req.params.sessionId, teacherId: req.user.id });
        if (!session) return res.status(404).json({ message: "Session not found" });
        const records = await Attendance.find({ sessionId: session._id }).populate("studentId", "name email rollNumber").sort({ markedAt: 1 });
        const present = records.filter(r => r.status === "Present").length;
        const flagged = records.filter(r => r.status === "Flagged").length;
        const totalStudents = await User.countDocuments({ role: "student" });
        return res.json({
            session: { id: session._id, subject: session.subject, active: session.active, startTime: session.startTime, expiryTime: session.expiryTime },
            totalStudents,
            present,
            flagged,
            absent: Math.max(0, totalStudents - records.length),
            percentage: totalStudents ? Math.round((present / totalStudents) * 100) : 0,
            students: records.map(record => ({
                name: record.studentId?.name || "Unknown",
                email: record.studentId?.email || "-",
                rollNumber: record.studentId?.rollNumber || "-",
                status: record.status,
                markedAt: record.markedAt,
                riskScore: record.riskScore,
                riskFlags: record.riskFlags,
                verification: record.verification,
                distanceMeters: record.location?.distanceMeters ?? null
            }))
        });
    } catch (error) {
        console.error("Attendance Summary Error:", error);
        return res.status(500).json({ message: "Failed to load attendance summary" });
    }
});

router.get("/student/me", authenticate, studentOnly, async (req, res) => {
    try {
        const records = await Attendance.find({ studentId: req.user.id }).populate({ path: "sessionId", select: "subject startTime expiryTime teacherId" }).sort({ markedAt: -1 }).limit(200);
        const totalSessions = await Session.countDocuments({ expiryTime: { $lte: new Date() } });
        const present = records.filter(r => r.status === "Present").length;
        const percentage = totalSessions ? Math.round((present / totalSessions) * 100) : 0;
        return res.json({
            totalSessions,
            present,
            flagged: records.filter(r => r.status === "Flagged").length,
            percentage,
            lastScan: records[0]?.markedAt || null,
            records: records.map(r => ({ id: r._id, subject: r.sessionId?.subject || "Unknown", markedAt: r.markedAt, status: r.status, riskScore: r.riskScore }))
        });
    } catch (error) {
        console.error("Student summary error:", error);
        return res.status(500).json({ message: "Failed to load student attendance" });
    }
});

router.get("/export/:sessionId", authenticate, teacherOnly, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.sessionId)) return res.status(400).json({ message: "Invalid session ID" });
        const session = await Session.findOne({ _id: req.params.sessionId, teacherId: req.user.id });
        if (!session) return res.status(404).json({ message: "Session not found" });
        const records = await Attendance.find({ sessionId: session._id }).populate("studentId", "name email rollNumber").sort({ markedAt: 1 });
        const escapeCsv = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const rows = ["Roll Number,Student Name,Email,Marked At,Status,Risk Score,Risk Flags,QR Verified,Location Verified,Device Verified,Distance (m)"];
        for (const r of records) {
            rows.push([
                r.studentId?.rollNumber,
                r.studentId?.name,
                r.studentId?.email,
                r.markedAt?.toISOString(),
                r.status,
                r.riskScore,
                (r.riskFlags || []).join("; "),
                r.verification?.qr,
                r.verification?.location,
                r.verification?.device,
                r.location?.distanceMeters ?? ""
            ].map(escapeCsv).join(","));
        }
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="attendance-${session._id}.csv"`);
        return res.send(rows.join("\n"));
    } catch (error) {
        console.error("Export error:", error);
        return res.status(500).json({ message: "Failed to export attendance" });
    }
});

module.exports = router;
