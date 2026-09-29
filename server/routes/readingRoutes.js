const express = require("express");
const mongoose = require("mongoose");
const SolarInstallation = require("../models/SolarInstallation");
const GenerationReading = require("../models/GenerationReading");

const router = express.Router();

// GET latest reading for an installation
router.get("/installations/:id/latest-reading", async (req, res) => {
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

        const installation = await SolarInstallation.findById(id);

        if (!installation) {
            return res.status(404).json({
                status: "error",
                code: "INSTALLATION_NOT_FOUND",
                message: "Solar installation not found",
                detail: "No solar installation exists with the supplied ID"
            });
        }

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

// GET historical readings with pagination, sorting and time filtering
router.get("/installations/:id/readings", async (req, res) => {
    try {
        const { id } = req.params;
        const { from, to } = req.query;

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

        // Pagination parameters
        const page = Math.max(parseInt(req.query.page) || 1, 1);

        const limit = Math.min(
            Math.max(parseInt(req.query.limit) || 20, 1),
            100
        );

        const skip = (page - 1) * limit;

        // Sorting
        const sortQuery = req.query.sort || "asc";

        if (!["asc", "desc"].includes(sortQuery)) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_SORT",
                message: "Invalid sort value",
                detail: "The sort parameter must be either 'asc' or 'desc'"
            });
        }

        const sortOrder = sortQuery === "desc" ? -1 : 1;

        // Base filter
        const filter = {
            installation: id
        };

        // Validate and apply "from" time filter
        if (from) {
            const fromDate = new Date(from);

            if (Number.isNaN(fromDate.getTime())) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_FROM_DATE",
                    message: "Invalid from date",
                    detail: "The 'from' parameter must be a valid date and time"
                });
            }

            filter.timestamp = {
                ...filter.timestamp,
                $gte: fromDate
            };
        }

        // Validate and apply "to" time filter
        if (to) {
            const toDate = new Date(to);

            if (Number.isNaN(toDate.getTime())) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_TO_DATE",
                    message: "Invalid to date",
                    detail: "The 'to' parameter must be a valid date and time"
                });
            }

            filter.timestamp = {
                ...filter.timestamp,
                $lte: toDate
            };
        }

        // Validate time range
        if (
            filter.timestamp &&
            filter.timestamp.$gte &&
            filter.timestamp.$lte &&
            filter.timestamp.$gte > filter.timestamp.$lte
        ) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_TIME_RANGE",
                message: "Invalid time range",
                detail: "The 'from' date must be earlier than or equal to the 'to' date"
            });
        }

        // Get total number of matching readings
        const totalCount = await GenerationReading.countDocuments(filter);

        // Get paginated readings
        const readings = await GenerationReading.find(filter)
            .sort({ timestamp: sortOrder })
            .skip(skip)
            .limit(limit)
            .populate("installation", "name installationId meterId inverterId");

        const totalPages = Math.ceil(totalCount / limit);

        // Create pagination links
        const baseUrl =
            `${req.protocol}://${req.get("host")}/api${req.path}`;

        const createPageUrl = (pageNumber) => {
            const params = new URLSearchParams();

            params.set("page", pageNumber);
            params.set("limit", limit);
            params.set("sort", sortQuery);

            if (from) {
                params.set("from", from);
            }

            if (to) {
                params.set("to", to);
            }

            return `${baseUrl}?${params.toString()}`;
        };

        const next =
            page < totalPages
                ? createPageUrl(page + 1)
                : null;

        const previous =
            page > 1
                ? createPageUrl(page - 1)
                : null;

        res.status(200).json({
            status: "success",
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                next,
                previous
            },
            filters: {
                from: from || null,
                to: to || null
            },
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

// GET a specific generation reading
router.get(
    "/installations/:id/readings/:readingId",
    async (req, res) => {
        try {
            const { id, readingId } = req.params;

            // Validate installation ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_INSTALLATION_ID",
                    message: "Invalid installation ID",
                    detail: "The supplied installation ID is not a valid MongoDB ObjectId"
                });
            }

            // Validate reading ID
            if (!mongoose.Types.ObjectId.isValid(readingId)) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_READING_ID",
                    message: "Invalid reading ID",
                    detail: "The supplied reading ID is not a valid MongoDB ObjectId"
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

            // Find the reading belonging to this installation
            const reading = await GenerationReading.findOne({
                _id: readingId,
                installation: id
            }).populate(
                "installation",
                "name installationId meterId inverterId"
            );

            if (!reading) {
                return res.status(404).json({
                    status: "error",
                    code: "READING_NOT_FOUND",
                    message: "Generation reading not found",
                    detail: "No reading exists with the supplied reading ID for this installation"
                });
            }

            res.status(200).json({
                status: "success",
                data: reading
            });
        } catch (error) {
            res.status(500).json({
                status: "error",
                message: "Failed to retrieve generation reading",
                detail: error.message
            });
        }
    }
);

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

        // Validate numeric fields
        if (
            typeof powerKw !== "number" ||
            typeof cumulativeEnergyKwh !== "number" ||
            typeof voltage !== "number" ||
            !Number.isFinite(powerKw) ||
            !Number.isFinite(cumulativeEnergyKwh) ||
            !Number.isFinite(voltage)
        ) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_READING_VALUES",
                message: "Invalid generation reading values",
                detail: "powerKw, cumulativeEnergyKwh and voltage must be valid numeric values"
            });
        }

        // Validate non-negative values
        if (
            powerKw < 0 ||
            cumulativeEnergyKwh < 0 ||
            voltage < 0
        ) {
            return res.status(400).json({
                status: "error",
                code: "NEGATIVE_READING_VALUE",
                message: "Generation reading values cannot be negative",
                detail: "powerKw, cumulativeEnergyKwh and voltage must be zero or greater"
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
        const location =
            `${req.protocol}://${req.get("host")}/api/installations/${id}/readings/${reading._id}`;

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