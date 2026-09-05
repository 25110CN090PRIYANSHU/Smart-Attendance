const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Attendance = require("../models/Attendance");
const Session = require("../models/Session");
const User = require("../models/User");
const { authenticate, studentOnly, teacherOnly } = require("../middleware/auth");
const { publish } = require("../live");
const Notification = require("../models/Notification");
const { getQrToken, getSlot } = require("./session");

const router = express.Router();

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = v => v * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hashDevice(deviceId) {
  const secret = process.env.DEVICE_HASH_SECRET || process.env.JWT_SECRET;
  return crypto.createHmac("sha256", secret).update(String(deviceId)).digest("hex");
}

function calculateRisk({ locationOk, deviceOk, accuracy, distance }) {
  let score = 0;
  const flags = [];
  if (!locationOk) { score += 55; flags.push("Outside classroom geofence"); }
  if (Number.isFinite(accuracy) && accuracy > 100) { score += 15; flags.push("Low GPS accuracy"); }
  if (Number.isFinite(distance) && distance > 25) score += Math.min(20, Math.round(distance / 25));
  if (!deviceOk) { score += 45; flags.push("Untrusted device"); }
  return { score: Math.min(100, score), flags };
}

function isPresentStatus(status) { return status === "Present" || status === "Late" || status === "Excused"; }

async function getOwnedSession(sessionId, teacherId) {
  if (!mongoose.isValidObjectId(sessionId)) return null;
  return Session.findOne({ _id: sessionId, teacherId });
}

router.post("/mark", authenticate, studentOnly, async (req, res) => {
  try {
    const { sessionId, token, slot, deviceId, location } = req.body;
    if (!sessionId || !mongoose.isValidObjectId(sessionId) || !token || !Number.isInteger(Number(slot))) return res.status(400).json({ message: "Invalid attendance QR data" });
    if (!deviceId || String(deviceId).length < 16 || String(deviceId).length > 200) return res.status(400).json({ message: "Secure device identification is required" });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Attendance session not found" });
    const now = new Date();
    if (!session.active || now >= session.expiryTime) {
      if (session.active) { session.active = false; await session.save(); }
      return res.status(400).json({ message: "Attendance session is closed or expired" });
    }

    const currentSlot = getSlot(session, now.getTime());
    const scannedSlot = Number(slot);
    const elapsed = now.getTime() - session.startTime.getTime();
    const withinPreviousGrace = scannedSlot === currentSlot - 1 && elapsed % (session.qrIntervalSec * 1000) <= 2500;
    const slotValid = scannedSlot === currentSlot || withinPreviousGrace;
    const expected = getQrToken(session, scannedSlot);
    const provided = Buffer.from(String(token));
    const expectedBuffer = Buffer.from(expected);
    const qrOk = slotValid && provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
    if (!qrOk) return res.status(400).json({ message: "QR code is expired or invalid. Scan the current QR." });

    const duplicate = await Attendance.findOne({ studentId: req.user.id, sessionId: session._id });
    if (duplicate) return res.status(409).json({ message: "Attendance already marked for this session", attendance: duplicate });

    const student = await User.findById(req.user.id);
    if (!student) return res.status(401).json({ message: "Student account not found" });

    const submittedDeviceHash = hashDevice(deviceId);
    let deviceOk = true;
    if (session.requireDeviceBinding) {
      if (!student.deviceIdHash) {
        student.deviceIdHash = submittedDeviceHash;
        student.deviceBoundAt = now;
        await student.save();
      } else deviceOk = student.deviceIdHash === submittedDeviceHash;
    }

    let locationOk = !session.requireLocation;
    let distance = null;
    let accuracy = null;
    let cleanLocation;
    if (location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))) {
      const lat = Number(location.lat), lng = Number(location.lng);
      accuracy = Number(location.accuracy);
      cleanLocation = { lat, lng };
      if (Number.isFinite(accuracy)) cleanLocation.accuracyMeters = accuracy;
    }
    if (session.requireLocation) {
      if (!cleanLocation) return res.status(400).json({ message: "Location permission is required for this classroom session" });
      if (!session.classroomLocation) return res.status(500).json({ message: "This session has no classroom location configured" });
      distance = haversineMeters(session.classroomLocation.lat, session.classroomLocation.lng, cleanLocation.lat, cleanLocation.lng);
      locationOk = distance <= session.classroomLocation.radiusMeters && (!Number.isFinite(accuracy) || accuracy <= 150);
      cleanLocation.distanceMeters = Math.round(distance);
      if (!locationOk) return res.status(403).json({ message: `You are outside the allowed classroom area (${Math.round(distance)}m away).`, distanceMeters: Math.round(distance), radiusMeters: session.classroomLocation.radiusMeters });
    }

    const risk = calculateRisk({ locationOk, deviceOk, accuracy, distance });
    const lateAfter = Number(session.lateAfterMinutes ?? 10) * 60 * 1000;
    const status = !deviceOk || risk.score >= 50 ? "Flagged" : (now.getTime() - session.startTime.getTime() > lateAfter ? "Late" : "Present");

    const attendance = await Attendance.create({
      studentId: req.user.id,
      sessionId: session._id,
      markedAt: now,
      status,
      verification: { qr: true, location: locationOk, device: deviceOk },
      location: cleanLocation,
      deviceIdHash: submittedDeviceHash,
      riskScore: risk.score,
      riskFlags: risk.flags
    });

    publish(session._id, "attendance", {
      studentId: req.user.id,
      attendanceId: attendance._id,
      status,
      riskScore: risk.score,
      markedAt: now
    });
    await Notification.create({
      userId: req.user.id,
      title: status === "Flagged" ? "Attendance needs review" : status === "Late" ? "Late attendance recorded" : "Attendance marked",
      message: `${session.subject}: ${status}.`,
      type: status === "Flagged" ? "warning" : "success"
    });

    res.status(201).json({
      message: status === "Flagged" ? "Attendance recorded and flagged for teacher review" : status === "Late" ? "Attendance marked as late" : "Attendance marked successfully",
      attendance: { id: attendance._id, status, riskScore: risk.score, riskFlags: risk.flags, distanceMeters: cleanLocation?.distanceMeters ?? null },
      subject: session.subject,
      markedAt: now,
      verified: { qr: true, location: locationOk, device: deviceOk }
    });
  } catch (error) {
    console.error("Mark Attendance Error:", error);
    if (error.code === 11000) return res.status(409).json({ message: "Attendance already marked for this session" });
    res.status(500).json({ message: "Failed to mark attendance" });
  }
});

router.get("/session/:sessionId", authenticate, teacherOnly, async (req, res) => {
  try {
    const session = await getOwnedSession(req.params.sessionId, req.user.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const records = await Attendance.find({ sessionId: session._id }).populate("studentId", "name email rollNumber profilePicture branch year section").sort({ markedAt: 1 });
    res.json(records);
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to fetch attendance" }); }
});

router.get("/session/:sessionId/summary", authenticate, teacherOnly, async (req, res) => {
  try {
    const session = await getOwnedSession(req.params.sessionId, req.user.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const records = await Attendance.find({ sessionId: session._id }).populate("studentId", "name email rollNumber profilePicture branch year section").sort({ markedAt: 1 });
    const studentFilter = { role: "student" };
    if (session.branch) studentFilter.branch = session.branch;
    if (session.year) studentFilter.year = session.year;
    if (session.section) studentFilter.section = session.section;
    const totalStudents = await User.countDocuments(studentFilter);
    const present = records.filter(r => r.status === "Present").length;
    const late = records.filter(r => r.status === "Late").length;
    const flagged = records.filter(r => r.status === "Flagged").length;
    const excused = records.filter(r => r.status === "Excused").length;
    const absent = records.filter(r => r.status === "Absent").length + Math.max(0, totalStudents - records.length);
    const counted = records.filter(r => isPresentStatus(r.status)).length;
    const percentage = totalStudents ? Math.round((counted / totalStudents) * 100) : 0;
    res.json({
      session: { id: session._id, subject: session.subject, active: session.active, startTime: session.startTime, expiryTime: session.expiryTime, lateAfterMinutes: session.lateAfterMinutes ?? 10 },
      totalStudents, present, late, flagged, excused, absent, percentage,
      students: records.map(record => ({
        id: record._id,
        name: record.studentId?.name || "Unknown",
        email: record.studentId?.email || "-",
        profilePicture: record.studentId?.profilePicture || "",
        rollNumber: record.studentId?.rollNumber || "-",
        status: record.status,
        markedAt: record.markedAt,
        riskScore: record.riskScore,
        riskFlags: record.riskFlags,
        verification: record.verification,
        distanceMeters: record.location?.distanceMeters ?? null,
        review: record.review
      }))
    });
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load attendance summary" }); }
});

router.post("/:attendanceId/review", authenticate, teacherOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attendanceId)) return res.status(400).json({ message: "Invalid attendance ID" });
    const action = String(req.body.action || "").toLowerCase();
    if (!["approve", "reject", "excuse"].includes(action)) return res.status(400).json({ message: "Invalid review action" });
    const record = await Attendance.findById(req.params.attendanceId).populate("sessionId");
    if (!record || !record.sessionId || record.sessionId.teacherId.toString() !== req.user.id) return res.status(404).json({ message: "Attendance record not found" });
    const status = action === "approve" ? (new Date(record.markedAt).getTime() - new Date(record.sessionId.startTime).getTime() > Number(record.sessionId.lateAfterMinutes ?? 10) * 60000 ? "Late" : "Present") : action === "excuse" ? "Excused" : "Rejected";
    record.status = status;
    record.review = { reviewed: true, reviewedBy: req.user.id, reviewedAt: new Date(), note: String(req.body.note || "").slice(0, 500) };
    await record.save();
    res.json({ message: `Attendance ${status.toLowerCase()}`, status, attendanceId: record._id });
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to review attendance" }); }
});

router.get("/student/me", authenticate, studentOnly, async (req, res) => {
  try {
    const sessions = await Session.find({ expiryTime: { $lte: new Date() } }).select("subject startTime expiryTime").sort({ startTime: -1 }).limit(500).lean();
    const records = await Attendance.find({ studentId: req.user.id }).populate({ path: "sessionId", select: "subject startTime expiryTime teacherId" }).sort({ markedAt: -1 }).limit(500).lean();
    const recordMap = new Map(records.filter(r => r.sessionId).map(r => [String(r.sessionId._id), r]));
    const counted = records.filter(r => isPresentStatus(r.status));
    const percentage = sessions.length ? Math.round((counted.length / sessions.length) * 100) : 0;

    const bySubject = new Map();
    for (const s of sessions) {
      const key = s.subject || "Unknown";
      if (!bySubject.has(key)) bySubject.set(key, { subject: key, total: 0, present: 0, late: 0, flagged: 0, absent: 0 });
      const item = bySubject.get(key); item.total += 1;
      const r = recordMap.get(String(s._id));
      if (!r) item.absent += 1;
      else if (r.status === "Present") item.present += 1;
      else if (r.status === "Late") { item.late += 1; item.present += 1; }
      else if (r.status === "Flagged") item.flagged += 1;
    }
    const subjects = [...bySubject.values()].map(x => ({ ...x, percentage: x.total ? Math.round((x.present / x.total) * 100) : 0 }));
    res.json({ totalSessions: sessions.length, present: counted.length, flagged: records.filter(r => r.status === "Flagged").length, late: records.filter(r => r.status === "Late").length, percentage, lastScan: records[0]?.markedAt || null, subjects, records: records.map(r => ({ id: r._id, subject: r.sessionId?.subject || "Unknown", markedAt: r.markedAt, status: r.status, riskScore: r.riskScore, riskFlags: r.riskFlags })) });
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load student attendance" }); }
});

router.get("/export/:sessionId", authenticate, teacherOnly, async (req, res) => {
  try {
    const session = await getOwnedSession(req.params.sessionId, req.user.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const records = await Attendance.find({ sessionId: session._id }).populate("studentId", "name email rollNumber profilePicture branch year section").sort({ markedAt: 1 });
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Roll Number","Student Name","Email","Marked At","Status","Risk Score","Risk Flags","QR Verified","Location Verified","Device Verified","Distance (m)"]];
    for (const r of records) rows.push([r.studentId?.rollNumber,r.studentId?.name,r.studentId?.email,r.markedAt?.toISOString(),r.status,r.riskScore,(r.riskFlags||[]).join("; "),r.verification?.qr,r.verification?.location,r.verification?.device,r.location?.distanceMeters ?? "" ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${session._id}.csv"`);
    res.send(rows.map(row => row.map(esc).join(",")).join("\n"));
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to export attendance" }); }
});

module.exports = router;
