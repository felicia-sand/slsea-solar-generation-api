const express = require("express");
const mongoose = require("mongoose");
const Province = require("../models/Province");

const router = express.Router();

// GET all provinces
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
            message: "Failed to retrieve provinces",
            detail: error.message
        });
    }
});

// GET one province by ID
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
            message: "Failed to retrieve province",
            detail: error.message
        });
    }
});

module.exports = router;