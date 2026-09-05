const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 100 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        role: { type: String, enum: ["student", "teacher"], required: true },
        rollNumber: { type: String, unique: true, sparse: true, trim: true },
        deviceIdHash: { type: String, default: null },
        deviceBoundAt: { type: Date, default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
