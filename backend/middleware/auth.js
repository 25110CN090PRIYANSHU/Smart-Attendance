const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

function teacherOnly(req, res, next) {

    if (req.user.role !== "teacher") {
        return res.status(403).json({
            message: "Teacher access required"
        });
    }

    next();
}

function studentOnly(req, res, next) {

    if (req.user.role !== "student") {
        return res.status(403).json({
            message: "Student access required"
        });
    }

    next();
}

module.exports = {
    authenticate,
    teacherOnly,
    studentOnly
};