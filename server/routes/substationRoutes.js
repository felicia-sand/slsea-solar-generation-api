const express = require("express");
const mongoose = require("mongoose");
const GridSubstation = require("../models/GridSubstation");

const router = express.Router();

// GET all grid substations
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
            message: "Failed to retrieve grid substations",
            detail: error.message
        });
    }
});

// GET one grid substation by ID
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
            message: "Failed to retrieve grid substation",
            detail: error.message
        });
    }
});

module.exports = router;