const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Session",
            required: true
        },

        markedAt: {
            type: Date,
            default: Date.now
        },

        status: {
            type: String,
            default: "Present"
        }
    },
    {
        timestamps: true
    }
);

attendanceSchema.index(
    {
        studentId: 1,
        sessionId: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model(
    "Attendance",
    attendanceSchema
);