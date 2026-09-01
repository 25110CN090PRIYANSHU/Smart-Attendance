require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const sessionRoutes = require("./routes/session");
const attendanceRoutes = require("./routes/attendance");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(path.join(__dirname, "../public")));

let cachedConnection = null;

// MongoDB connection
async function connectDB() {
    if (cachedConnection) {
        return cachedConnection;
    }

    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI environment variable is not set");
    }

    cachedConnection = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000
    });

    console.log("MongoDB Connected Successfully");

    return cachedConnection;
}

// Connect MongoDB before API requests
app.use("/api", async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("MongoDB Connection Failed:", error.message);

        res.status(500).json({
            message: "Database connection failed"
        });
    }
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/attendance", attendanceRoutes);

// Test API
app.get("/api/test", (req, res) => {
    res.json({
        message: "Smart Attendance API is working"
    });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});