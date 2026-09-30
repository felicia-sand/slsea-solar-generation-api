const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                status: "error",
                code: "AUTHENTICATION_REQUIRED",
                message: "Authentication is required",
                detail: "Provide a valid Bearer token in the Authorization header"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            status: "error",
            code: "INVALID_TOKEN",
            message: "Invalid or expired authentication token",
            detail: "The supplied JWT could not be verified"
        });
    }
};

module.exports = protect;