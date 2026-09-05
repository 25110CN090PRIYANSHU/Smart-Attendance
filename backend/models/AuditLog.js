const mongoose = require("mongoose");
const auditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, required: true, maxlength: 100 },
  targetType: { type: String, default: "" },
  targetId: { type: String, default: "" },
  details: { type: String, default: "", maxlength: 1000 }
}, { timestamps: true });
module.exports = mongoose.model("AuditLog", auditSchema);
