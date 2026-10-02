const express = require("express");
const mongoose = require("mongoose");
const Province = require("../models/Province");

const router = express.Router();

/**
 * @swagger
 * /api/provinces:
 *   get:
 *     summary: Get all provinces
 *     description: Returns all provinces sorted alphabetically by name.
 *     tags:
 *       - Provinces
 *     responses:
 *       200:
 *         description: List of provinces retrieved successfully
 *       500:
 *         description: Failed to retrieve provinces
 */
router.get("/", async (req, res) => {
    try {
        const provinces = await Province.find().sort({ name: 1 });

        res.status(200).json({
            status: "success",
            count: provinces.length,
            data: provinces
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "PROVINCES_RETRIEVAL_FAILED",
            message: "Failed to retrieve provinces",
            detail: error.message
        });
    }
});

/**
 * @swagger
 * /api/provinces/{id}:
 *   get:
 *     summary: Get a province by ID
 *     description: Returns a single province using its MongoDB ObjectId.
 *     tags:
 *       - Provinces
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: MongoDB ObjectId of the province
 *         schema:
 *           type: string
 *         example: 68a123456789012345678901
 *     responses:
 *       200:
 *         description: Province retrieved successfully
 *       400:
 *         description: Invalid province ID
 *       404:
 *         description: Province not found
 *       500:
 *         description: Failed to retrieve province
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check whether the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_ID",
                message: "Invalid province ID",
                detail: "The supplied province ID is not a valid MongoDB ObjectId"
            });
        }

        const province = await Province.findById(id);

        // Province does not exist
        if (!province) {
            return res.status(404).json({
                status: "error",
                code: "PROVINCE_NOT_FOUND",
                message: "Province not found",
                detail: "No province exists with the supplied ID"
            });
        }

        res.status(200).json({
            status: "success",
            data: province
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "PROVINCES_RETRIEVAL_FAILED",
            message: "Failed to retrieve province",
            detail: error.message
        });
    }
});

module.exports = router;