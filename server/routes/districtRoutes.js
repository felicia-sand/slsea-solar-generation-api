const express = require("express");
const mongoose = require("mongoose");
const District = require("../models/District");

const router = express.Router();

// GET all districts
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
            message: "Failed to retrieve districts",
            detail: error.message
        });
    }
});

// GET one district by ID
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
            message: "Failed to retrieve district",
            detail: error.message
        });
    }
});

module.exports = router;