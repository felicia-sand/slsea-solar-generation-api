const express = require("express");
const mongoose = require("mongoose");
const GridSubstation = require("../models/GridSubstation");

const router = express.Router();

/**
 * @swagger
 * /api/substations:
 *   get:
 *     summary: Get all grid substations
 *     description: Retrieve all grid substations with their associated district details.
 *     tags: [Substations]
 *     responses:
 *       200:
 *         description: Successfully retrieved grid substations
 *       500:
 *         description: Failed to retrieve grid substations
 */
router.get("/", async (req, res) => {
    try {
        const substations = await GridSubstation.find()
            .populate("district", "name code province")
            .sort({ name: 1 });

        res.status(200).json({
            status: "success",
            count: substations.length,
            data: substations
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "SUBSTATIONS_RETRIEVAL_FAILED",
            message: "Failed to retrieve grid substations",
            detail: error.message
        });
    }
});

/**
 * @swagger
 * /api/substations/{id}:
 *   get:
 *     summary: Get a grid substation by ID
 *     description: Retrieve a single grid substation using its MongoDB ObjectId.
 *     tags: [Substations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the grid substation
 *         schema:
 *           type: string
 *           example: 64f123456789abcdef123456
 *     responses:
 *       200:
 *         description: Successfully retrieved grid substation
 *       400:
 *         description: Invalid substation ID
 *       404:
 *         description: Grid substation not found
 *       500:
 *         description: Failed to retrieve grid substation
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_ID",
                message: "Invalid substation ID",
                detail: "The supplied substation ID is not a valid MongoDB ObjectId"
            });
        }

        const substation = await GridSubstation.findById(id)
            .populate("district", "name code province");

        if (!substation) {
            return res.status(404).json({
                status: "error",
                code: "SUBSTATION_NOT_FOUND",
                message: "Grid substation not found",
                detail: "No grid substation exists with the supplied ID"
            });
        }

        res.status(200).json({
            status: "success",
            data: substation
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "SUBSTATIONS_RETRIEVAL_FAILED",
            message: "Failed to retrieve grid substations",
            detail: error.message
        });
    }
});

module.exports = router;