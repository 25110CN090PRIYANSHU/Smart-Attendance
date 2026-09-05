const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true, maxlength: 100 },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null },
    room: { type: String, default: "" },
    branch: { type: String, default: "" },
    year: { type: String, default: "" },
    section: { type: String, default: "" },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    qrSecret: { type: String, required: true },
    qrIntervalSec: { type: Number, default: 10, min: 5, max: 60 },
    startTime: { type: Date, required: true },
    expiryTime: { type: Date, required: true },
    active: { type: Boolean, default: true },
    lateAfterMinutes: { type: Number, default: 10, min: 0, max: 120 },
    classroomLocation: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
      radiusMeters: { type: Number, min: 10, max: 1000, default: 100 }
    },
    requireLocation: { type: Boolean, default: false },
    requireDeviceBinding: { type: Boolean, default: true }
  },
  { timestamps: true }
);

sessionSchema.index({ teacherId: 1, createdAt: -1 });
sessionSchema.index({ active: 1, expiryTime: 1 });

module.exports = mongoose.model("Session", sessionSchema);
