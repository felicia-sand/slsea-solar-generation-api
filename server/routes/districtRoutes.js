const express = require("express");
const mongoose = require("mongoose");
const District = require("../models/District");

const router = express.Router();

/**
 * @swagger
 * /api/districts:
 *   get:
 *     summary: Get all districts
 *     description: Retrieve all districts with their associated province details.
 *     tags: [Districts]
 *     responses:
 *       200:
 *         description: Successfully retrieved districts
 *       500:
 *         description: Failed to retrieve districts
 */
router.get("/", async (req, res) => {
    try {
        const districts = await District.find()
            .populate("province", "name code")
            .sort({ name: 1 });

        res.status(200).json({
            status: "success",
            count: districts.length,
            data: districts
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "DISTRICTS_RETRIEVAL_FAILED",
            message: "Failed to retrieve districts",
            detail: error.message
        });
    }
});

/**
 * @swagger
 * /api/districts/{id}:
 *   get:
 *     summary: Get a district by ID
 *     description: Retrieve a single district using its MongoDB ObjectId.
 *     tags: [Districts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the district
 *         schema:
 *           type: string
 *           example: 64f123456789abcdef123456
 *     responses:
 *       200:
 *         description: Successfully retrieved district
 *       400:
 *         description: Invalid district ID
 *       404:
 *         description: District not found
 *       500:
 *         description: Failed to retrieve district
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_ID",
                message: "Invalid district ID",
                detail: "The supplied district ID is not a valid MongoDB ObjectId"
            });
        }

        const district = await District.findById(id)
            .populate("province", "name code");

        if (!district) {
            return res.status(404).json({
                status: "error",
                code: "DISTRICT_NOT_FOUND",
                message: "District not found",
                detail: "No district exists with the supplied ID"
            });
        }

        res.status(200).json({
            status: "success",
            data: district
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "DISTRICTS_RETRIEVAL_FAILED",
            message: "Failed to retrieve districts",
            detail: error.message
        });
    }
});

module.exports = router;