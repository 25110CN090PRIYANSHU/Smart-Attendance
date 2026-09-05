require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const { router: authRoutes, publicUser } = require("./routes/auth");
const { router: sessionRoutes } = require("./routes/session");
const attendanceRoutes = require("./routes/attendance");
const adminRoutes = require("./routes/admin");
const advancedRoutes = require("./routes/advanced");
const User = require("./models/User");
const Session = require("./models/Session");
const Attendance = require("./models/Attendance");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
let cachedConnection = null;
let lastConnectionAttempt = 0;

app.disable("x-powered-by");
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  next();
});

// Small in-memory rate limiter. It protects the demo/deployment without another dependency.
const rateBuckets = new Map();
function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    let bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) bucket = { startedAt: now, count: 0 };
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    if (bucket.count > max) return res.status(429).json({ message });
    next();
  };
}
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, bucket] of rateBuckets) if (bucket.startedAt < cutoff) rateBuckets.delete(key);
}, 10 * 60 * 1000).unref();

app.use(express.static(path.join(__dirname, "../public"), { extensions: ["html"] }));

async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) return cachedConnection;
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI environment variable is not set");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  const now = Date.now();
  if (now - lastConnectionAttempt < 3000 && mongoose.connection.readyState === 0) throw new Error("Database connection is temporarily unavailable");
  lastConnectionAttempt = now;
  cachedConnection = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("MongoDB Connected Successfully");
  return cachedConnection;
}

app.get("/api/test", (req, res) => res.json({ message: "Smart Attendance API is working", version: "4.0" }));
app.get("/api/health", (req, res) => res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected", version: "4.0", time: new Date().toISOString() }));

app.use("/api", async (req, res, next) => {
  try { await connectDB(); next(); }
  catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    res.status(503).json({ message: "Database connection failed. Check MONGO_URI and MongoDB Atlas network access." });
  }
});

app.use("/api/auth/login", rateLimit({ windowMs: 5 * 60 * 1000, max: 12, message: "Too many login attempts. Please wait a few minutes." }));
app.use("/api/auth", authRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/advanced", advancedRoutes);
app.use("/api/attendance", rateLimit({ windowMs: 60 * 1000, max: 90, message: "Too many requests. Please slow down." }), attendanceRoutes);

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ message: "Unexpected server error" });
});

async function autoFinalizeExpiredSessions(){
  try{
    const expired=await Session.find({active:true,expiryTime:{$lte:new Date()}}).limit(20);
    for(const session of expired){
      const filter={role:"student",active:true};if(session.branch)filter.branch=session.branch;if(session.year)filter.year=session.year;if(session.section)filter.section=session.section;
      const students=await User.find(filter).select("_id").lean();const existing=await Attendance.find({sessionId:session._id}).select("studentId").lean();const seen=new Set(existing.map(x=>String(x.studentId)));const missing=students.filter(x=>!seen.has(String(x._id)));
      if(missing.length)await Attendance.insertMany(missing.map(x=>({studentId:x._id,sessionId:session._id,status:"Absent",riskFlags:["Automatic absence after session expiry"]})),{ordered:false});
      session.active=false;await session.save();
    }
  }catch(e){console.error("Auto-finalize error:",e.message)}
}

async function ensureAdmin() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  try {
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const existing = await User.findOne({ email });
    if (!existing) {
      await User.create({ name: process.env.ADMIN_NAME || "System Administrator", email, password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: "admin" });
      console.log(`Admin account created: ${email}`);
    } else if (existing.role !== "admin") {
      existing.role = "admin";
      await existing.save();
      console.log(`Admin role enabled for: ${email}`);
    }
  } catch (e) { console.error("Admin bootstrap failed:", e.message); }
}

app.listen(PORT, async () => {
  console.log(`SmartAttend X v4.0 running on port ${PORT}`);
  try { await connectDB(); await ensureAdmin(); } catch (e) { console.error("Startup DB check:", e.message); }
  setInterval(async()=>{if(mongoose.connection.readyState===1)await autoFinalizeExpiredSessions()},60000).unref();
});
