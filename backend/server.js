require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const { router: sessionRoutes } = require("./routes/session");
const attendanceRoutes = require("./routes/attendance");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "../public")));

let cachedConnection = null;

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

// Database middleware
const databaseMiddleware = async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("MongoDB Connection Failed:", error.message);

        return res.status(500).json({
            message: "Database connection failed",
            error: error.message
        });
    }
};

// IMPORTANT:
// Register middleware as a normal function.
app.use("/api", databaseMiddleware);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/attendance", attendanceRoutes);

// Test API
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Smart Attendance API is working"
    });
});

// Frontend fallback
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled Server Error:", err);

    res.status(err.status || 500).json({
        message: err.message || "Internal server error"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});