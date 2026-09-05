const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");

const router = express.Router();

function cleanEmail(email) {
    return String(email || "").trim().toLowerCase();
}

router.post("/register", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = cleanEmail(req.body.email);
        const password = String(req.body.password || "");
        const role = req.body.role;
        const rollNumber = String(req.body.rollNumber || "").trim() || undefined;

        if (name.length < 2) return res.status(400).json({ message: "Name must be at least 2 characters" });
        if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
        if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
        if (!["student", "teacher"].includes(role)) return res.status(400).json({ message: "Invalid role" });
        if (role === "student" && !rollNumber) return res.status(400).json({ message: "Roll number is required for students" });

        const existingUser = await User.findOne({ $or: [{ email }, ...(rollNumber ? [{ rollNumber }] : [])] });
        if (existingUser) return res.status(400).json({ message: existingUser.email === email ? "Email already registered" : "Roll number already registered" });

        const user = await User.create({
            name,
            email,
            password: await bcrypt.hash(password, 12),
            role,
            rollNumber
        });

        return res.status(201).json({ message: "Registration successful", userId: user._id });
    } catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({ message: "Server error during registration" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const email = cleanEmail(req.body.email);
        const password = String(req.body.password || "");
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: user._id.toString(), name: user.name, role: user.role, rollNumber: user.rollNumber || null },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        return res.json({
            message: "Login successful",
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber || null, deviceBound: Boolean(user.deviceIdHash) }
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Server error during login" });
    }
});

module.exports = router;
