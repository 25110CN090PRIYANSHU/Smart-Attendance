const jwt = require("jsonwebtoken");
const User = require("../models/User");

function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : null;
        if (!token) return res.status(401).json({ message: "Authentication required" });
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        User.findById(req.user.id).select("tokenVersion active role").then(user=>{
            if(!user || user.active===false || Number(user.tokenVersion||0)!==Number(req.user.tokenVersion||0)) return res.status(401).json({message:"Session expired. Please log in again."});
            next();
        }).catch(()=>res.status(401).json({message:"Authentication check failed"}));
    } catch (_) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) return res.status(403).json({ message: "You do not have permission for this action" });
        next();
    };
}

const teacherOnly = requireRole("teacher");
const studentOnly = requireRole("student");
const adminOnly = requireRole("admin");

module.exports = { authenticate, requireRole, teacherOnly, studentOnly, adminOnly };
