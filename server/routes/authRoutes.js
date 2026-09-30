const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                code: "MISSING_CREDENTIALS",
                message: "Email and password are required",
                detail: "Provide both email and password to authenticate"
            });
        }

        // Find user
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user) {
            return res.status(401).json({
                status: "error",
                code: "INVALID_CREDENTIALS",
                message: "Invalid email or password",
                detail: "The supplied credentials are incorrect"
            });
        }

        // Compare password
        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                status: "error",
                code: "INVALID_CREDENTIALS",
                message: "Invalid email or password",
                detail: "The supplied credentials are incorrect"
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role,
                province: user.province,
                district: user.district
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        res.status(200).json({
            status: "success",
            message: "Authentication successful",
            data: {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    province: user.province,
                    district: user.district
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "AUTHENTICATION_ERROR",
            message: "Authentication failed",
            detail: error.message
        });
    }
});

// GET /api/auth/me
// Protected test endpoint
router.get("/me", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("-password")
            .populate("province", "name code")
            .populate("district", "name code");

        if (!user) {
            return res.status(404).json({
                status: "error",
                code: "USER_NOT_FOUND",
                message: "Authenticated user not found",
                detail: "The user associated with the supplied token no longer exists"
            });
        }

        res.status(200).json({
            status: "success",
            data: user
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "USER_LOOKUP_FAILED",
            message: "Failed to retrieve authenticated user",
            detail: error.message
        });
    }
});

module.exports = router;