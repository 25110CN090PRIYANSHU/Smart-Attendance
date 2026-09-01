const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
    {
        subject: {
            type: String,
            required: true
        },

        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // Current QR token
        // This token changes after every successful scan.
        sessionToken: {
            type: String,
            required: true,
            unique: true
        },

        startTime: {
            type: Date,
            required: true
        },

        expiryTime: {
            type: Date,
            required: true
        },

        active: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Session",
    sessionSchema
);