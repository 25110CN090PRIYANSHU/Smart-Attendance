const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "teacher", "admin"], required: true },
    rollNumber: { type: String, unique: true, sparse: true, trim: true },
    branch: { type: String, trim: true, maxlength: 100, default: "" },
    year: { type: String, trim: true, maxlength: 30, default: "" },
    section: { type: String, trim: true, maxlength: 30, default: "" },
    profilePicture: { type: String, default: "" },
    deviceIdHash: { type: String, default: null },
    deviceBoundAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    emailVerificationTokenHash: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    twoFactorCodeHash: { type: String, default: null },
    twoFactorExpires: { type: Date, default: null },
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
