const express = require("express");
const mongoose = require("mongoose");
const SolarInstallation = require("../models/SolarInstallation");
const GenerationReading = require("../models/GenerationReading");

const router = express.Router();

// GET latest reading for an installation
router.get("/installations/:id/latest-reading", async (req, res) => {
    try {
        const { id } = req.params;

        // Validate installation ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_ID",
                message: "Invalid installation ID",
                detail: "The supplied installation ID is not a valid MongoDB ObjectId"
            });
        }

        // Check that the installation exists
        const installation = await SolarInstallation.findById(id);

        if (!installation) {
            return res.status(404).json({
                status: "error",
                code: "INSTALLATION_NOT_FOUND",
                message: "Solar installation not found",
                detail: "No solar installation exists with the supplied ID"
            });
        }

        // Get the most recent reading
        const reading = await GenerationReading.findOne({
            installation: id
        })
            .sort({ timestamp: -1 })
            .populate("installation", "name installationId meterId inverterId");

        if (!reading) {
            return res.status(404).json({
                status: "error",
                code: "READING_NOT_FOUND",
                message: "No generation reading found",
                detail: "No generation reading exists for this installation"
            });
        }

        res.status(200).json({
            status: "success",
            data: reading
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Failed to retrieve latest generation reading",
            detail: error.message
        });
    }
});

// GET all historical readings for an installation
router.get("/installations/:id/readings", async (req, res) => {
    try {
        const { id } = req.params;

        // Validate installation ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_ID",
                message: "Invalid installation ID",
                detail: "The supplied installation ID is not a valid MongoDB ObjectId"
            });
        }

        // Check that the installation exists
        const installation = await SolarInstallation.findById(id);

        if (!installation) {
            return res.status(404).json({
                status: "error",
                code: "INSTALLATION_NOT_FOUND",
                message: "Solar installation not found",
                detail: "No solar installation exists with the supplied ID"
            });
        }

        // Get all readings for the installation
        const readings = await GenerationReading.find({
            installation: id
        })
            .sort({ timestamp: 1 })
            .populate("installation", "name installationId meterId inverterId");

        res.status(200).json({
            status: "success",
            count: readings.length,
            data: readings
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Failed to retrieve generation readings",
            detail: error.message
        });
    }
});

// POST a new generation reading for an installation
router.post("/installations/:id/readings", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            timestamp,
            powerKw,
            cumulativeEnergyKwh,
            voltage
        } = req.body;

        // Validate installation ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_ID",
                message: "Invalid installation ID",
                detail: "The supplied installation ID is not a valid MongoDB ObjectId"
            });
        }

        // Check that the installation exists
        const installation = await SolarInstallation.findById(id);

        if (!installation) {
            return res.status(404).json({
                status: "error",
                code: "INSTALLATION_NOT_FOUND",
                message: "Solar installation not found",
                detail: "No solar installation exists with the supplied ID"
            });
        }

        // Validate required fields
        if (
            timestamp === undefined ||
            powerKw === undefined ||
            cumulativeEnergyKwh === undefined ||
            voltage === undefined
        ) {
            return res.status(400).json({
                status: "error",
                code: "MISSING_FIELDS",
                message: "Required reading fields are missing",
                detail: "timestamp, powerKw, cumulativeEnergyKwh and voltage are required"
            });
        }

        // Validate timestamp
        const readingTimestamp = new Date(timestamp);

        if (Number.isNaN(readingTimestamp.getTime())) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_TIMESTAMP",
                message: "Invalid timestamp",
                detail: "The timestamp must be a valid date and time"
            });
        }

        // Create the reading
        const reading = await GenerationReading.create({
            installation: id,
            timestamp: readingTimestamp,
            powerKw,
            cumulativeEnergyKwh,
            voltage
        });

        // Location header for the newly created resource
        const location = `${req.protocol}://${req.get("host")}/api/installations/${id}/readings/${reading._id}`;

        res
            .status(201)
            .location(location)
            .json({
                status: "success",
                message: "Generation reading created successfully",
                data: reading
            });
    } catch (error) {
        // Duplicate installation + timestamp
        if (error.code === 11000) {
            return res.status(400).json({
                status: "error",
                code: "DUPLICATE_READING",
                message: "Generation reading already exists",
                detail: "A reading already exists for this installation and timestamp"
            });
        }

        res.status(500).json({
            status: "error",
            message: "Failed to create generation reading",
            detail: error.message
        });
    }
});

module.exports = router;