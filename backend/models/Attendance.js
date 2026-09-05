const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
    markedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["Present", "Late", "Flagged", "Rejected", "Excused"], default: "Present" },
    verification: {
      qr: { type: Boolean, default: false },
      location: { type: Boolean, default: false },
      device: { type: Boolean, default: false }
    },
    location: { lat: Number, lng: Number, accuracyMeters: Number, distanceMeters: Number },
    deviceIdHash: String,
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskFlags: { type: [String], default: [] },
    review: {
      reviewed: { type: Boolean, default: false },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reviewedAt: { type: Date, default: null },
      note: { type: String, maxlength: 500, default: "" }
    }
  },
  { timestamps: true }
);

attendanceSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });
attendanceSchema.index({ sessionId: 1, markedAt: 1 });
attendanceSchema.index({ status: 1, riskScore: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
