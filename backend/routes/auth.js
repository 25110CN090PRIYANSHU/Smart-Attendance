const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

const router = express.Router();
function cleanEmail(email) { return String(email || "").trim().toLowerCase(); }
function safePicture(value) {
  if (!value) return "";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(value) || value.length > 700000) throw new Error("Profile picture must be JPG, PNG or WebP and under 500KB");
  return value;
}
function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber || null, branch: user.branch || "", year: user.year || "", section: user.section || "", profilePicture: user.profilePicture || "", deviceBound: Boolean(user.deviceIdHash), active: user.active !== false };
}

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim(); const email = cleanEmail(req.body.email); const password = String(req.body.password || "");
    const role = req.body.role; const rollNumber = String(req.body.rollNumber || "").trim() || undefined; const teacherCode = String(req.body.teacherCode || "");
    if (name.length < 2) return res.status(400).json({ message: "Name must be at least 2 characters" });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (!["student", "teacher"].includes(role)) return res.status(400).json({ message: "Invalid role" });
    if (role === "teacher" && process.env.TEACHER_REGISTRATION_CODE && teacherCode !== process.env.TEACHER_REGISTRATION_CODE) return res.status(403).json({ message: "Valid teacher registration code is required" });
    if (role === "student" && !rollNumber) return res.status(400).json({ message: "Roll number is required for students" });
    const picture = safePicture(req.body.profilePicture);
    const existingUser = await User.findOne({ $or: [{ email }, ...(rollNumber ? [{ rollNumber }] : [])] });
    if (existingUser) return res.status(400).json({ message: existingUser.email === email ? "Email already registered" : "Roll number already registered" });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role, rollNumber, branch: String(req.body.branch || "").trim(), year: String(req.body.year || "").trim(), section: String(req.body.section || "").trim(), profilePicture: picture });
    res.status(201).json({ message: "Registration successful", userId: user._id });
  } catch (error) { console.error("Registration error:", error); res.status(500).json({ message: error.message || "Server error during registration" }); }
});

router.post("/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email); const password = String(req.body.password || ""); const user = await User.findOne({ email });
    if (!user || user.active === false || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: "Invalid email or password" });
    const token = jwt.sign({ id: user._id.toString(), name: user.name, role: user.role, rollNumber: user.rollNumber || null }, process.env.JWT_SECRET, { expiresIn: "2h" });
    res.json({ message: "Login successful", token, user: publicUser(user) });
  } catch (error) { console.error("Login error:", error); res.status(500).json({ message: "Server error during login" }); }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email); const user = await User.findOne({ email });
    // Always return the same public message to avoid account enumeration.
    if (!user) return res.json({ message: "If an account exists, a password reset link has been prepared." });
    const raw = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    const link = `${req.protocol}://${req.get("host")}/reset.html?token=${raw}`;
    if (process.env.SMTP_HOST) {
      try {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_SECURE) === "true", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
        await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: user.email, subject: "SmartAttend password reset", text: `Reset your SmartAttend password within 15 minutes: ${link}` });
      } catch (mailError) { console.error("Reset email failed:", mailError.message); }
    }
    const response = { message: "If an account exists, a password reset link has been prepared." };
    if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST) response.devResetLink = link;
    res.json(response);
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to start password reset" }); }
});

router.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || ""); const password = String(req.body.password || "");
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({ resetPasswordTokenHash: hash, resetPasswordExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: "Reset link is invalid or expired" });
    user.password = await bcrypt.hash(password, 12); user.resetPasswordTokenHash = null; user.resetPasswordExpires = null; await user.save();
    res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to reset password" }); }
});

module.exports = { router, publicUser };
