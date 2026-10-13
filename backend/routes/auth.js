const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const LoginEvent = require("../models/LoginEvent");
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
function cleanEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}
function safePicture(value) {
  if (!value) return "";
  if (
    !/^data:image\/(jpeg|png|webp);base64,/.test(value) ||
    value.length > 700000
  )
    throw new Error("Profile picture must be JPG, PNG or WebP and under 500KB");
  return value;
}
function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    rollNumber: user.rollNumber || null,
    branch: user.branch || "",
    year: user.year || "",
    section: user.section || "",
    profilePicture: user.profilePicture || "",
    deviceBound: Boolean(user.deviceIdHash),
    active: user.active !== false,
  };
}

router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ message: "Failed to load profile" });
  }
});

router.patch("/profile", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const name = req.body.name !== undefined ? String(req.body.name).trim() : null;
    const email = req.body.email !== undefined ? cleanEmail(req.body.email) : null;
    const branch = req.body.branch !== undefined ? String(req.body.branch).trim() : null;
    const year = req.body.year !== undefined ? String(req.body.year).trim() : null;
    const section = req.body.section !== undefined ? String(req.body.section).trim() : null;
    const rollNumber = req.body.rollNumber !== undefined ? String(req.body.rollNumber).trim() : null;
    const profilePicture = req.body.profilePicture;
    const currentPassword = req.body.currentPassword ? String(req.body.currentPassword) : null;
    const newPassword = req.body.newPassword ? String(req.body.newPassword) : null;

    if (name !== null) {
      if (name.length < 2) return res.status(400).json({ message: "Name must be at least 2 characters" });
      user.name = name;
    }

    if (email !== null && email !== user.email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailExists) return res.status(400).json({ message: "Email is already taken by another account" });
      user.email = email;
    }

    if (branch !== null) user.branch = branch;
    if (year !== null) user.year = year;
    if (section !== null) user.section = section;

    if (user.role === "student" && rollNumber !== null) {
      if (!rollNumber) return res.status(400).json({ message: "Roll number cannot be empty for students" });
      const rollExists = await User.findOne({ rollNumber, _id: { $ne: user._id } });
      if (rollExists) return res.status(400).json({ message: "Roll number already registered to another student" });
      user.rollNumber = rollNumber;
    }

    if (profilePicture !== undefined) {
      if (!profilePicture) {
        user.profilePicture = "";
      } else {
        user.profilePicture = safePicture(profilePicture);
      }
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to change password" });
      }
      const validCurrent = await bcrypt.compare(currentPassword, user.password);
      if (!validCurrent) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      user.password = await bcrypt.hash(newPassword, 12);
    }

    await user.save();

    try {
      await Notification.create({
        userId: user._id,
        title: "Profile updated",
        message: `Your profile details were updated on ${new Date().toLocaleString()}.`,
        type: "info",
      });
    } catch (_) {}

    res.json({
      message: "Profile updated successfully",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: error.message || "Failed to update profile" });
  }
});

router.put("/profile", authenticate, async (req, res) => {
  // Delegate PUT to PATCH handler logic
  req.method = "PATCH";
  return router.handle(req, res);
});

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");
    const role = req.body.role;
    const rollNumber = String(req.body.rollNumber || "").trim() || undefined;
    const teacherCode = String(req.body.teacherCode || "").trim();
    if (name.length < 2)
      return res
        .status(400)
        .json({ message: "Name must be at least 2 characters" });
    if (!/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ message: "Enter a valid email address" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    if (!["student", "teacher"].includes(role))
      return res.status(400).json({ message: "Invalid role" });
    // Teacher registration is protected by a server-side code.
    // Trim accidental spaces/quotes from Render's environment value so an
    // otherwise correct code is not rejected because of formatting.
    if (role === "teacher") {
      const configuredTeacherCode = String(
        process.env.TEACHER_REGISTRATION_CODE || ""
      )
        .trim()
        .replace(/^(["'])|(["'])$/g, "");

      if (!configuredTeacherCode) {
        console.error(
          "TEACHER_REGISTRATION_CODE is missing from environment variables."
        );
        return res.status(500).json({
          message:
            "Teacher registration is not configured. Contact the administrator.",
        });
      }

      if (teacherCode !== configuredTeacherCode) {
        return res
          .status(403)
          .json({ message: "Valid teacher registration code is required" });
      }
    }
    if (role === "student" && !rollNumber)
      return res
        .status(400)
        .json({ message: "Roll number is required for students" });
    const picture = safePicture(req.body.profilePicture);
    const existingUser = await User.findOne({
      $or: [{ email }, ...(rollNumber ? [{ rollNumber }] : [])],
    });
    if (existingUser)
      return res
        .status(400)
        .json({
          message:
            existingUser.email === email
              ? "Email already registered"
              : "Roll number already registered",
        });
    const verificationRaw = crypto.randomBytes(32).toString("hex");
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role,
      rollNumber,
      branch: String(req.body.branch || "").trim(),
      year: String(req.body.year || "").trim(),
      section: String(req.body.section || "").trim(),
      profilePicture: picture,
      emailVerificationTokenHash: crypto
        .createHash("sha256")
        .update(verificationRaw)
        .digest("hex"),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const verifyLink = `${req.protocol}://${req.get("host")}/api/auth/verify-email?token=${verificationRaw}`;
    if (process.env.SMTP_HOST) {
      try {
        const nodemailer = require("nodemailer");
        const t = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE) === "true",
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await t.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: "Verify your SmartAttend account",
          text: `Verify your email within 24 hours: ${verifyLink}`,
        });
      } catch (e) {
        console.error("Verification email failed:", e.message);
      }
    }
    const response = {
      message:
        "Registration successful. Check your email to verify your account.",
      userId: user._id,
    };
    if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST)
      response.devVerificationLink = verifyLink;
    res.status(201).json(response);
  } catch (error) {
    console.error("Registration error:", error);
    res
      .status(500)
      .json({ message: error.message || "Server error during registration" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });
    if (!user || user.active === false) {
      await LoginEvent.create({
        email,
        success: false,
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
      });
      return res.status(400).json({ message: "Invalid email or password" });
    }
    if (user.lockUntil && user.lockUntil.getTime() > Date.now())
      return res
        .status(423)
        .json({
          message:
            "Account temporarily locked after repeated failed logins. Try again later.",
        });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      await LoginEvent.create({
        userId: user._id,
        email,
        success: false,
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
      });
      return res.status(400).json({ message: "Invalid email or password" });
    }
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
    await LoginEvent.create({
      userId: user._id,
      email,
      success: true,
      ip: req.ip,
      userAgent: req.get("user-agent") || "",
    });
    await Notification.create({
      userId: user._id,
      title: "New login",
      message: `Successful login at ${new Date().toLocaleString()}.`,
      type: "info",
    });
    if (
      user.role === "admin" &&
      String(process.env.ADMIN_2FA_ENABLED).toLowerCase() === "true"
    ) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      user.twoFactorCodeHash = crypto
        .createHash("sha256")
        .update(code)
        .digest("hex");
      user.twoFactorExpires = new Date(Date.now() + 5 * 60 * 1000);
      await user.save();
      const challengeToken = jwt.sign(
        { id: user._id.toString(), purpose: "2fa" },
        process.env.JWT_SECRET,
        { expiresIn: "5m" },
      );
      if (process.env.SMTP_HOST) {
        try {
          const nodemailer = require("nodemailer");
          const t = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE) === "true",
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });
          await t.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: user.email,
            subject: "SmartAttend admin verification code",
            text: `Your SmartAttend admin verification code is ${code}. It expires in 5 minutes.`,
          });
        } catch (e) {
          console.error("2FA email failed:", e.message);
        }
      }
      const response = {
        message: "Verification code required",
        requires2FA: true,
        challengeToken,
        user: publicUser(user),
      };
      if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST)
        response.devCode = code;
      return res.json(response);
    }
    const token = jwt.sign(
      {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        rollNumber: user.rollNumber || null,
        tokenVersion: user.tokenVersion || 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );
    res.json({ message: "Login successful", token, user: publicUser(user) });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

router.get("/verify-email", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      emailVerificationTokenHash: hash,
      emailVerificationExpires: { $gt: new Date() },
    });
    if (!user)
      return res.status(400).send("Verification link is invalid or expired.");
    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();
    res.send(
      "Email verified successfully. You can return to SmartAttend and log in.",
    );
  } catch (e) {
    res.status(500).send("Unable to verify email.");
  }
});
router.post("/verify-2fa", async (req, res) => {
  try {
    const challenge = jwt.verify(
      String(req.body.challengeToken || ""),
      process.env.JWT_SECRET,
    );
    if (challenge.purpose !== "2fa")
      return res.status(401).json({ message: "Invalid challenge" });
    const user = await User.findById(challenge.id);
    const code = String(req.body.code || "");
    if (
      !user ||
      !user.twoFactorExpires ||
      user.twoFactorExpires < Date.now() ||
      crypto.createHash("sha256").update(code).digest("hex") !==
        user.twoFactorCodeHash
    )
      return res
        .status(401)
        .json({ message: "Invalid or expired verification code" });
    user.twoFactorCodeHash = null;
    user.twoFactorExpires = null;
    await user.save();
    const token = jwt.sign(
      {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        rollNumber: user.rollNumber || null,
        tokenVersion: user.tokenVersion || 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );
    res.json({ message: "Login successful", token, user: publicUser(user) });
  } catch (e) {
    res
      .status(401)
      .json({ message: "Invalid or expired verification challenge" });
  }
});
router.post("/logout-all", authenticate, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $inc: { tokenVersion: 1 } });
    res.json({ message: "All active sessions have been revoked." });
  } catch (e) {
    res.status(500).json({ message: "Unable to revoke sessions" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const user = await User.findOne({ email });
    // Always return the same public message to avoid account enumeration.
    if (!user)
      return res.json({
        message:
          "If an account exists, a password reset link has been prepared.",
      });
    const raw = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = crypto
      .createHash("sha256")
      .update(raw)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    const link = `${req.protocol}://${req.get("host")}/reset.html?token=${raw}`;
    if (process.env.SMTP_HOST) {
      try {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE) === "true",
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email,
          subject: "SmartAttend password reset",
          text: `Reset your SmartAttend password within 15 minutes: ${link}`,
        });
      } catch (mailError) {
        console.error("Reset email failed:", mailError.message);
      }
    }
    const response = {
      message: "If an account exists, a password reset link has been prepared.",
    };
    if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST)
      response.devResetLink = link;
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to start password reset" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordTokenHash: hash,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user)
      return res
        .status(400)
        .json({ message: "Reset link is invalid or expired" });
    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();
    res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to reset password" });
  }
});

module.exports = { router, publicUser };
