const express = require("express");
const mongoose = require("mongoose");
const SolarInstallation = require("../models/SolarInstallation");

const router = express.Router();

// GET all solar installations
router.get("/", async (req, res) => {
    try {
        const installations = await SolarInstallation.find()
            .populate({
                path: "gridSubstation",
                select: "name code district",
                populate: {
                    path: "district",
                    select: "name code province",
                    populate: {
                        path: "province",
                        select: "name code"
                    }
                }
            })
            .sort({ name: 1 });

        res.status(200).json({
            status: "success",
            count: installations.length,
            data: installations
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Failed to retrieve solar installations",
            detail: error.message
        });
    }
});

// GET one solar installation by ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_ID",
                message: "Invalid installation ID",
                detail: "The supplied installation ID is not a valid MongoDB ObjectId"
            });
        }

        const installation = await SolarInstallation.findById(id)
            .populate({
                path: "gridSubstation",
                select: "name code district",
                populate: {
                    path: "district",
                    select: "name code province",
                    populate: {
                        path: "province",
                        select: "name code"
                    }
                }
            });

        if (!installation) {
            return res.status(404).json({
                status: "error",
                code: "INSTALLATION_NOT_FOUND",
                message: "Solar installation not found",
                detail: "No solar installation exists with the supplied ID"
            });
        }

        res.status(200).json({
            status: "success",
            data: installation
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Failed to retrieve solar installation",
            detail: error.message
        });
    }
});

module.exports = router;