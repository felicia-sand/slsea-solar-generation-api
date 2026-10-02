const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");

const SolarInstallation = require("../models/SolarInstallation");
const GenerationReading = require("../models/GenerationReading");
const Province = require("../models/Province");
const District = require("../models/District");
const GridSubstation = require("../models/GridSubstation");

const protect = require("../middleware/authMiddleware");
const authorizeInstallationAccess = require("../middleware/jurisdictionMiddleware");

const router = express.Router();

// ============================================================
// Helper: escape regex characters
// ============================================================
const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ============================================================
// Helper: build search condition for code, name or ObjectId
// ============================================================
const buildSearchCondition = (value) => {
    const conditions = [
        {
            code: {
                $regex: `^${escapeRegex(value)}$`,
                $options: "i"
            }
        },
        {
            name: {
                $regex: `^${escapeRegex(value)}$`,
                $options: "i"
            }
        }
    ];

    if (mongoose.Types.ObjectId.isValid(value)) {
        conditions.push({
            _id: new mongoose.Types.ObjectId(value)
        });
    }

    return { $or: conditions };
};

/**
 * @swagger
 * /api/readings:
 *   get:
 *     summary: Get generation readings
 *     description: Retrieve generation readings with jurisdiction-based authorization, filtering, pagination, date range filtering, and sorting.
 *     tags: [Generation Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: province
 *         required: false
 *         description: Province name, code, or ID
 *         schema:
 *           type: string
 *         example: Western
 *
 *       - in: query
 *         name: district
 *         required: false
 *         description: District name, code, or ID
 *         schema:
 *           type: string
 *         example: Colombo
 *
 *       - in: query
 *         name: substation
 *         required: false
 *         description: Grid substation name, code, or ID
 *         schema:
 *           type: string
 *         example: Colombo Grid Substation
 *
 *       - in: query
 *         name: from
 *         required: false
 *         description: Start date and time for the reading range
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2026-09-20T00:00:00Z
 *
 *       - in: query
 *         name: to
 *         required: false
 *         description: End date and time for the reading range
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2026-09-21T23:59:59Z
 *
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Number of readings per page. Maximum 100.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         example: 20
 *
 *       - in: query
 *         name: sort
 *         required: false
 *         description: Sort readings by timestamp
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         example: desc
 *
 *     responses:
 *       200:
 *         description: Successfully retrieved generation readings
 *       400:
 *         description: Invalid sort value, date value, or time range
 *       401:
 *         description: Authentication required or invalid token
 *       403:
 *         description: User is not authorized to access the requested readings
 *       500:
 *         description: Failed to retrieve generation readings
 */
router.get("/readings", protect, async (req, res) => {
    try {
        const {
            province,
            district,
            substation,
            from,
            to
        } = req.query;

        // --------------------------------------------------------
        // Pagination
        // --------------------------------------------------------
        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(parseInt(req.query.limit) || 20, 1),
            100
        );

        const skip = (page - 1) * limit;

        // --------------------------------------------------------
        // Sorting
        // --------------------------------------------------------
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

        // --------------------------------------------------------
        // Start with installations allowed by user jurisdiction
        // --------------------------------------------------------
        let allowedSubstationIds = null;

        // National users can access all installations
        if (req.user.role === "national") {
            allowedSubstationIds = null;
        }

        // Provincial users can access only their province
        else if (req.user.role === "provincial") {
            if (!req.user.province) {
                return res.status(403).json({
                    status: "error",
                    code: "JURISDICTION_FORBIDDEN",
                    message: "Access denied",
                    detail: "The provincial user does not have a province assigned"
                });
            }

            const districts = await District.find({
                province: req.user.province
            }).select("_id");

            const districtIds = districts.map(
                (item) => item._id
            );

            const substations = await GridSubstation.find({
                district: { $in: districtIds }
            }).select("_id");

            allowedSubstationIds = substations.map(
                (item) => item._id
            );
        }

        // District users can access only their district
        else if (req.user.role === "district") {
            if (!req.user.district) {
                return res.status(403).json({
                    status: "error",
                    code: "JURISDICTION_FORBIDDEN",
                    message: "Access denied",
                    detail: "The district user does not have a district assigned"
                });
            }

            const substations = await GridSubstation.find({
                district: req.user.district
            }).select("_id");

            allowedSubstationIds = substations.map(
                (item) => item._id
            );
        }

        else {
            return res.status(403).json({
                status: "error",
                code: "ROLE_FORBIDDEN",
                message: "Access denied",
                detail: "The user role is not authorized to access generation readings"
            });
        }

        // --------------------------------------------------------
        // Apply province filter
        // --------------------------------------------------------
        if (province) {
            const provinceDocument = await Province.findOne(
                buildSearchCondition(province)
            );

            if (!provinceDocument) {
                return res.status(200).json({
                    status: "success",
                    pagination: {
                        page,
                        limit,
                        totalCount: 0,
                        totalPages: 0,
                        next: null,
                        previous: null
                    },
                    filters: {
                        province,
                        district: district || null,
                        substation: substation || null,
                        from: from || null,
                        to: to || null
                    },
                    count: 0,
                    data: []
                });
            }

            const districts = await District.find({
                province: provinceDocument._id
            }).select("_id");

            const districtIds = districts.map(
                (item) => item._id
            );

            const substations = await GridSubstation.find({
                district: { $in: districtIds }
            }).select("_id");

            const provinceSubstationIds = substations.map(
                (item) => item._id
            );

            if (allowedSubstationIds === null) {
                allowedSubstationIds = provinceSubstationIds;
            } else {
                const allowedSet = new Set(
                    allowedSubstationIds.map(
                        (id) => id.toString()
                    )
                );

                allowedSubstationIds =
                    provinceSubstationIds.filter(
                        (id) => allowedSet.has(id.toString())
                    );
            }
        }

        // --------------------------------------------------------
        // Apply district filter
        // --------------------------------------------------------
        if (district) {
            const districtDocument = await District.findOne(
                buildSearchCondition(district)
            );

            if (!districtDocument) {
                return res.status(200).json({
                    status: "success",
                    pagination: {
                        page,
                        limit,
                        totalCount: 0,
                        totalPages: 0,
                        next: null,
                        previous: null
                    },
                    filters: {
                        province: province || null,
                        district,
                        substation: substation || null,
                        from: from || null,
                        to: to || null
                    },
                    count: 0,
                    data: []
                });
            }

            const substations = await GridSubstation.find({
                district: districtDocument._id
            }).select("_id");

            const districtSubstationIds = substations.map(
                (item) => item._id
            );

            if (allowedSubstationIds === null) {
                allowedSubstationIds = districtSubstationIds;
            } else {
                const allowedSet = new Set(
                    allowedSubstationIds.map(
                        (id) => id.toString()
                    )
                );

                allowedSubstationIds =
                    districtSubstationIds.filter(
                        (id) => allowedSet.has(id.toString())
                    );
            }
        }

        // --------------------------------------------------------
        // Apply substation filter
        // --------------------------------------------------------
        if (substation) {
            const substationDocument =
                await GridSubstation.findOne(
                    buildSearchCondition(substation)
                );

            if (!substationDocument) {
                return res.status(200).json({
                    status: "success",
                    pagination: {
                        page,
                        limit,
                        totalCount: 0,
                        totalPages: 0,
                        next: null,
                        previous: null
                    },
                    filters: {
                        province: province || null,
                        district: district || null,
                        substation,
                        from: from || null,
                        to: to || null
                    },
                    count: 0,
                    data: []
                });
            }

            if (allowedSubstationIds === null) {
                allowedSubstationIds = [
                    substationDocument._id
                ];
            } else {
                const isAllowed =
                    allowedSubstationIds.some(
                        (id) =>
                            id.toString() ===
                            substationDocument._id.toString()
                    );

                allowedSubstationIds = isAllowed
                    ? [substationDocument._id]
                    : [];
            }
        }

        // --------------------------------------------------------
        // Find installations under selected substations
        // --------------------------------------------------------
        const installationQuery = {};

        if (allowedSubstationIds !== null) {
            installationQuery.gridSubstation = {
                $in: allowedSubstationIds
            };
        }

        const installations =
            await SolarInstallation.find(
                installationQuery
            ).select("_id");

        const installationIds = installations.map(
            (installation) => installation._id
        );

        // --------------------------------------------------------
        // If there are no matching installations
        // --------------------------------------------------------
        if (installationIds.length === 0) {
            return res.status(200).json({
                status: "success",
                pagination: {
                    page,
                    limit,
                    totalCount: 0,
                    totalPages: 0,
                    next: null,
                    previous: null
                },
                filters: {
                    province: province || null,
                    district: district || null,
                    substation: substation || null,
                    from: from || null,
                    to: to || null
                },
                count: 0,
                data: []
            });
        }

        // --------------------------------------------------------
        // Build generation reading filter
        // --------------------------------------------------------
        const filter = {
            installation: {
                $in: installationIds
            }
        };

        // --------------------------------------------------------
        // From date
        // --------------------------------------------------------
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

        // --------------------------------------------------------
        // To date
        // --------------------------------------------------------
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

        // --------------------------------------------------------
        // Validate time range
        // --------------------------------------------------------
        if (
            filter.timestamp &&
            filter.timestamp.$gte &&
            filter.timestamp.$lte &&
            filter.timestamp.$gte >
                filter.timestamp.$lte
        ) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_TIME_RANGE",
                message: "Invalid time range",
                detail: "The 'from' date must be earlier than or equal to the 'to' date"
            });
        }

        // --------------------------------------------------------
        // Count matching readings
        // --------------------------------------------------------
        const totalCount =
            await GenerationReading.countDocuments(filter);

        // --------------------------------------------------------
        // Retrieve paginated readings
        // --------------------------------------------------------
        const readings =
            await GenerationReading.find(filter)
                .sort({ timestamp: sortOrder })
                .skip(skip)
                .limit(limit)
                .populate(
                    "installation",
                    "name installationId meterId inverterId capacityKw gridSubstation"
                );

        // --------------------------------------------------------
        // Pagination
        // --------------------------------------------------------
        const totalPages =
            Math.ceil(totalCount / limit);

        const baseUrl =
            `${req.protocol}://${req.get("host")}/api${req.path}`;

        const createPageUrl = (pageNumber) => {
            const params = new URLSearchParams();

            params.set("page", pageNumber);
            params.set("limit", limit);
            params.set("sort", sortQuery);

            if (province) {
                params.set("province", province);
            }

            if (district) {
                params.set("district", district);
            }

            if (substation) {
                params.set("substation", substation);
            }

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

        // --------------------------------------------------------
        // Response
        // --------------------------------------------------------
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
                province: province || null,
                district: district || null,
                substation: substation || null,
                from: from || null,
                to: to || null,
                sort: sortQuery
            },

            count: readings.length,
            data: readings
        });

    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "READING_FILTER_ERROR",
            message: "Failed to retrieve generation readings",
            detail: error.message
        });
    }
});

/**
 * @swagger
 * /api/installations/{id}/latest-reading:
 *   get:
 *     summary: Get the latest generation reading for an installation
 *     description: Retrieve the most recent generation reading for a solar installation. Access is protected by authentication and installation jurisdiction authorization.
 *     tags: [Generation Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the solar installation
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *       - in: header
 *         name: If-None-Match
 *         required: false
 *         description: ETag value from a previous response. If unchanged, the server returns 304 Not Modified.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved latest generation reading
 *         headers:
 *           ETag:
 *             description: Current representation version
 *             schema:
 *               type: string
 *       304:
 *         description: Not Modified
 *       400:
 *         description: Invalid installation ID
 *       401:
 *         description: Authentication required or invalid token
 *       403:
 *         description: Access denied by jurisdiction
 *       404:
 *         description: Installation or latest reading not found
 *       500:
 *         description: Failed to retrieve latest generation reading
 */
router.get(
    "/installations/:id/latest-reading",
    protect,
    authorizeInstallationAccess,
    async (req, res) => {
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

            const installation =
                await SolarInstallation.findById(id);

            if (!installation) {
                return res.status(404).json({
                    status: "error",
                    code: "INSTALLATION_NOT_FOUND",
                    message: "Solar installation not found",
                    detail: "No solar installation exists with the supplied ID"
                });
            }

            const reading =
                await GenerationReading.findOne({
                    installation: id
                })
                    .sort({ timestamp: -1 })
                    .populate(
                        "installation",
                        "name installationId meterId inverterId"
                    );

            if (!reading) {
                return res.status(404).json({
                    status: "error",
                    code: "READING_NOT_FOUND",
                    message: "No generation reading found",
                    detail: "No generation reading exists for this installation"
                });
            }

            // --------------------------------------------------------
            // ETag / Conditional GET
            // --------------------------------------------------------
            const responseData = {
                status: "success",
                data: reading
            };

            const etag = `"${crypto
                .createHash("sha256")
                .update(JSON.stringify(responseData))
                .digest("hex")}"`;

            res.set("ETag", etag);

            if (req.headers["if-none-match"] === etag) {
                return res.status(304).end();
            }

            res.status(200).json(responseData);

        } catch (error) {
            res.status(500).json({
                status: "error",
                code: "LATEST_READING_RETRIEVAL_FAILED",
                message: "Failed to retrieve latest generation reading",
                detail: error.message
            });
        }
    }
);

/**
 * @swagger
 * /api/installations/{id}/readings:
 *   get:
 *     summary: Get historical readings for an installation
 *     description: Retrieve paginated generation readings for one solar installation with optional time-window filtering and timestamp sorting.
 *     tags: [Generation Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the solar installation
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *
 *       - in: query
 *         name: from
 *         required: false
 *         description: Start date and time
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2026-09-20T00:00:00Z
 *
 *       - in: query
 *         name: to
 *         required: false
 *         description: End date and time
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2026-09-21T23:59:59Z
 *
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Number of readings per page. Maximum 100.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         example: 20
 *
 *       - in: query
 *         name: sort
 *         required: false
 *         description: Sort readings by timestamp
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         example: desc
 *
 *     responses:
 *       200:
 *         description: Successfully retrieved historical readings
 *       400:
 *         description: Invalid ID, sort value, date, or time range
 *       401:
 *         description: Authentication required or invalid token
 *       403:
 *         description: Access denied by jurisdiction
 *       404:
 *         description: Installation not found
 *       500:
 *         description: Failed to retrieve generation readings
 */
router.get(
    "/installations/:id/readings",
    protect,
    authorizeInstallationAccess,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { from, to } = req.query;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_ID",
                    message: "Invalid installation ID",
                    detail: "The supplied installation ID is not a valid MongoDB ObjectId"
                });
            }

            const installation =
                await SolarInstallation.findById(id);

            if (!installation) {
                return res.status(404).json({
                    status: "error",
                    code: "INSTALLATION_NOT_FOUND",
                    message: "Solar installation not found",
                    detail: "No solar installation exists with the supplied ID"
                });
            }

            const page = Math.max(
                parseInt(req.query.page) || 1,
                1
            );

            const limit = Math.min(
                Math.max(parseInt(req.query.limit) || 20, 1),
                100
            );

            const skip = (page - 1) * limit;

            const sortQuery = req.query.sort || "asc";

            if (!["asc", "desc"].includes(sortQuery)) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_SORT",
                    message: "Invalid sort value",
                    detail: "The sort parameter must be either 'asc' or 'desc'"
                });
            }

            const sortOrder =
                sortQuery === "desc" ? -1 : 1;

            const filter = {
                installation: id
            };

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

            if (
                filter.timestamp &&
                filter.timestamp.$gte &&
                filter.timestamp.$lte &&
                filter.timestamp.$gte >
                    filter.timestamp.$lte
            ) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_TIME_RANGE",
                    message: "Invalid time range",
                    detail: "The 'from' date must be earlier than or equal to the 'to' date"
                });
            }

            const totalCount =
                await GenerationReading.countDocuments(filter);

            const readings =
                await GenerationReading.find(filter)
                    .sort({ timestamp: sortOrder })
                    .skip(skip)
                    .limit(limit)
                    .populate(
                        "installation",
                        "name installationId meterId inverterId"
                    );

            const totalPages =
                Math.ceil(totalCount / limit);

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
                code: "READINGS_RETRIEVAL_FAILED",
                message: "Failed to retrieve generation readings",
                detail: error.message
            });
        }
    }
);

/**
 * @swagger
 * /api/installations/{id}/readings/{readingId}:
 *   get:
 *     summary: Get a specific generation reading
 *     description: Retrieve one generation reading belonging to a specific solar installation. Supports conditional GET using ETag.
 *     tags: [Generation Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the solar installation
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *
 *       - in: path
 *         name: readingId
 *         required: true
 *         description: MongoDB ObjectId of the generation reading
 *         schema:
 *           type: string
 *         example: 64f987654321abcdef654321
 *
 *       - in: header
 *         name: If-None-Match
 *         required: false
 *         description: ETag value from a previous response. If unchanged, the server returns 304 Not Modified.
 *         schema:
 *           type: string
 *
 *     responses:
 *       200:
 *         description: Successfully retrieved generation reading
 *         headers:
 *           ETag:
 *             description: Current representation version
 *             schema:
 *               type: string
 *
 *       304:
 *         description: Not Modified
 *
 *       400:
 *         description: Invalid installation or reading ID
 *
 *       401:
 *         description: Authentication required or invalid token
 *
 *       403:
 *         description: Access denied by jurisdiction
 *
 *       404:
 *         description: Installation or reading not found
 *
 *       500:
 *         description: Failed to retrieve generation reading
 */
router.get(
    "/installations/:id/readings/:readingId",
    protect,
    authorizeInstallationAccess,
    async (req, res) => {
        try {
            const { id, readingId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_INSTALLATION_ID",
                    message: "Invalid installation ID",
                    detail: "The supplied installation ID is not a valid MongoDB ObjectId"
                });
            }

            if (!mongoose.Types.ObjectId.isValid(readingId)) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_READING_ID",
                    message: "Invalid reading ID",
                    detail: "The supplied reading ID is not a valid MongoDB ObjectId"
                });
            }

            const installation =
                await SolarInstallation.findById(id);

            if (!installation) {
                return res.status(404).json({
                    status: "error",
                    code: "INSTALLATION_NOT_FOUND",
                    message: "Solar installation not found",
                    detail: "No solar installation exists with the supplied ID"
                });
            }

            const reading =
                await GenerationReading.findOne({
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

            // --------------------------------------------------------
            // ETag / Conditional GET
            // --------------------------------------------------------
            const responseData = {
                status: "success",
                data: reading
            };

            const etag = `"${crypto
                .createHash("sha256")
                .update(JSON.stringify(responseData))
                .digest("hex")}"`;

            res.set("ETag", etag);

            if (req.headers["if-none-match"] === etag) {
                return res.status(304).end();
            }

            res.status(200).json(responseData);

        } catch (error) {
            res.status(500).json({
                status: "error",
                code: "READING_RETRIEVAL_FAILED",
                message: "Failed to retrieve generation reading",
                detail: error.message
            });
        }
    }
);

/**
 * @swagger
 * /api/installations/{id}/readings:
 *   post:
 *     summary: Create a generation reading
 *     description: Submit a new generation reading for a solar installation. Device users may submit readings only for their own installation.
 *     tags: [Generation Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the solar installation
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - timestamp
 *               - powerKw
 *               - cumulativeEnergyKwh
 *               - voltage
 *             properties:
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-09-21T10:15:00Z
 *               powerKw:
 *                 type: number
 *                 minimum: 0
 *                 example: 125.5
 *               cumulativeEnergyKwh:
 *                 type: number
 *                 minimum: 0
 *                 example: 1850.75
 *               voltage:
 *                 type: number
 *                 minimum: 0
 *                 example: 230.4
 *
 *     responses:
 *       201:
 *         description: Generation reading created successfully
 *         headers:
 *           Location:
 *             description: URL of the newly created generation reading
 *             schema:
 *               type: string
 *
 *       400:
 *         description: Invalid installation ID, missing fields, invalid timestamp or values, negative values, or duplicate reading
 *
 *       401:
 *         description: Authentication required or invalid token
 *
 *       403:
 *         description: Device or user is not authorized to create this reading
 *
 *       404:
 *         description: Installation not found
 *
 *       500:
 *         description: Failed to create generation reading
 */
router.post(
    "/installations/:id/readings",
    protect,
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                timestamp,
                powerKw,
                cumulativeEnergyKwh,
                voltage
            } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_ID",
                    message: "Invalid installation ID",
                    detail: "The supplied installation ID is not a valid MongoDB ObjectId"
                });
            }

            const installation =
                await SolarInstallation.findById(id);

            if (!installation) {
                return res.status(404).json({
                    status: "error",
                    code: "INSTALLATION_NOT_FOUND",
                    message: "Solar installation not found",
                    detail: "No solar installation exists with the supplied ID"
                });
            }

            // Device users can write only to their own installation
            if (req.user.role === "device") {
                if (
                    !req.user.installation ||
                    req.user.installation.toString() !== id
                ) {
                    return res.status(403).json({
                        status: "error",
                        code: "INSTALLATION_FORBIDDEN",
                        message: "Access denied",
                        detail: "The device is not authorized to submit readings for this installation"
                    });
                }
            }

            // Only supported roles can create readings
            if (
                !["device", "national", "provincial", "district"]
                    .includes(req.user.role)
            ) {
                return res.status(403).json({
                    status: "error",
                    code: "ROLE_FORBIDDEN",
                    message: "Access denied",
                    detail: "The user role is not authorized to create generation readings"
                });
            }

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

            const readingTimestamp =
                new Date(timestamp);

            if (
                Number.isNaN(
                    readingTimestamp.getTime()
                )
            ) {
                return res.status(400).json({
                    status: "error",
                    code: "INVALID_TIMESTAMP",
                    message: "Invalid timestamp",
                    detail: "The timestamp must be a valid date and time"
                });
            }

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

            const reading =
                await GenerationReading.create({
                    installation: id,
                    timestamp: readingTimestamp,
                    powerKw,
                    cumulativeEnergyKwh,
                    voltage
                });

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
                code: "READING_CREATION_FAILED",
                message: "Failed to create generation reading",
                detail: error.message
            });
        }
    }
);

module.exports = router;