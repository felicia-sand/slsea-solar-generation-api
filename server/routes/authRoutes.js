const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user
 *     description: Authenticates a user using email and password and returns a JWT access token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: national.test@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: National@12345
 *     responses:
 *       200:
 *         description: Authentication successful
 *       400:
 *         description: Email and password are required
 *       401:
 *         description: Invalid email or password
 *       500:
 *         description: Authentication failed
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                code: "MISSING_CREDENTIALS",
                message: "Email and password are required",
                detail: "Provide both email and password to authenticate"
            });
        }

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

        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role,
                province: user.province,
                district: user.district,
                installation: user.installation
            },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
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
                    district: user.district,
                    installation: user.installation
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

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get authenticated user
 *     description: Returns the profile information of the currently authenticated user.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user information retrieved successfully
 *       401:
 *         description: Authentication is required or token is invalid
 *       404:
 *         description: Authenticated user not found
 *       500:
 *         description: Failed to retrieve authenticated user
 */
router.get("/me", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("-password")
            .populate("province", "name code")
            .populate("district", "name code")
            .populate(
                "installation",
                "name installationId meterId inverterId"
            );

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