const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();

router.post("/register", async (req, res) => {

    try {

        const {
            name,
            email,
            password,
            role,
            rollNumber
        } = req.body;

        const existingUser = await User.findOne({
            email
        });

        if (existingUser) {

            return res.status(400).json({
                message: "Email already registered"
            });

        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        const user = new User({
            name,
            email,
            password: hashedPassword,
            role,
            rollNumber: rollNumber?.trim() || undefined
        });

        await user.save();

        res.status(201).json({
            message: "Registration successful"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });
    }
});

router.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        const user = await User.findOne({
            email
        });

        if (!user) {

            return res.status(400).json({
                message: "Invalid email or password"
            });

        }

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordMatch) {

            return res.status(400).json({
                message: "Invalid email or password"
            });

        }

        const token = jwt.sign(
            {
                id: user._id,
                name: user.name,
                role: user.role,
                rollNumber: user.rollNumber
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                rollNumber: user.rollNumber
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });
    }
});

module.exports = router;