const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Session = require("../models/Session");
const Attendance = require("../models/Attendance");
const AuditLog = require("../models/AuditLog");
const { authenticate, adminOnly } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, adminOnly);

async function log(req, action, targetType = "", targetId = "", details = "") {
  try { await AuditLog.create({ actorId: req.user.id, action, targetType, targetId: String(targetId || ""), details }); } catch (e) { console.error("Audit log error:", e.message); }
}

router.get("/stats", async (req, res) => {
  try {
    const [students, teachers, admins, sessions, attendance, flagged] = await Promise.all([
      User.countDocuments({ role: "student", active: true }), User.countDocuments({ role: "teacher", active: true }), User.countDocuments({ role: "admin", active: true }),
      Session.countDocuments(), Attendance.countDocuments(), Attendance.countDocuments({ status: "Flagged" })
    ]);
    const today = new Date(); today.setHours(0,0,0,0);
    const todayRecords = await Attendance.find({ markedAt: { $gte: today } }).select("status").lean();
    const present = todayRecords.filter(x => ["Present","Late","Excused"].includes(x.status)).length;
    res.json({ students, teachers, admins, sessions, attendance, flagged, todayAttendance: todayRecords.length, todayPresent: present, todayPercentage: todayRecords.length ? Math.round(present / todayRecords.length * 100) : 0 });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed to load admin statistics" }); }
});

router.get("/users", async (req, res) => {
  try {
    const role = ["student","teacher","admin"].includes(req.query.role) ? req.query.role : undefined;
    const q = String(req.query.q || "").trim();
    const filter = role ? { role } : {};
    if (q) filter.$or = [{ name: new RegExp(q, "i") }, { email: new RegExp(q, "i") }, { rollNumber: new RegExp(q, "i") }];
    const users = await User.find(filter).select("-password -resetPasswordTokenHash -resetPasswordExpires -deviceIdHash").sort({ createdAt: -1 }).limit(500).lean();
    res.json({ users });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed to load users" }); }
});

router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, branch, year, section, profilePicture } = req.body;
    if (!name || !email || !password || !["student","teacher"].includes(role)) return res.status(400).json({ message: "Name, email, password and valid role are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (role === "student" && !rollNumber) return res.status(400).json({ message: "Roll number is required for students" });
    if (profilePicture && (!/^data:image\/(jpeg|png|webp);base64,/.test(profilePicture) || profilePicture.length > 700000)) return res.status(400).json({ message: "Profile picture must be JPG, PNG or WebP and under 500KB" });
    const normalized = String(email).trim().toLowerCase();
    if (await User.findOne({ $or: [{ email: normalized }, ...(rollNumber ? [{ rollNumber }] : [])] })) return res.status(409).json({ message: "Email or roll number already exists" });
    const user = await User.create({ name: String(name).trim(), email: normalized, password: await bcrypt.hash(password,12), role, rollNumber: role === "student" ? String(rollNumber).trim() : undefined, branch, year, section, profilePicture: profilePicture || "", createdBy: req.user.id });
    await log(req, "Created user", "User", user._id, `${role}: ${normalized}`);
    res.status(201).json({ message: "User created", user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed to create user" }); }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const allowed = ["name","email","rollNumber","branch","year","section","profilePicture","active"];
    const update = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
    if (req.body.password) update.password = await bcrypt.hash(String(req.body.password), 12);
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select("-password -resetPasswordTokenHash -resetPasswordExpires -deviceIdHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    await log(req, "Updated user", "User", user._id, Object.keys(update).join(", "));
    res.json({ message: "User updated", user });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed to update user" }); }
});

router.delete("/users/:id", async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ message: "You cannot delete your own admin account" });
    const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    await log(req, "Disabled user", "User", user._id, user.email);
    res.json({ message: "User disabled" });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed to disable user" }); }
});

router.get("/logs", async (req, res) => {
  try {
    const logs = await AuditLog.find().populate("actorId", "name email role").sort({ createdAt: -1 }).limit(300).lean();
    res.json({ logs });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed to load audit logs" }); }
});

module.exports = router;
