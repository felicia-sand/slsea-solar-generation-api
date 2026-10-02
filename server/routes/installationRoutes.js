const express = require("express");
const mongoose = require("mongoose");

const SolarInstallation = require("../models/SolarInstallation");
const Province = require("../models/Province");
const District = require("../models/District");
const GridSubstation = require("../models/GridSubstation");

const router = express.Router();

// Escape special regex characters
const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Find documents by ObjectId, code, or name
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
 * /api/installations:
 *   get:
 *     summary: Get all solar installations
 *     description: Retrieve solar installations with optional filtering by province, district, and grid substation.
 *     tags: [Installations]
 *     parameters:
 *       - in: query
 *         name: province
 *         required: false
 *         description: Province name, code, or ID
 *         schema:
 *           type: string
 *         example: WP
 *       - in: query
 *         name: district
 *         required: false
 *         description: District name, code, or ID
 *         schema:
 *           type: string
 *         example: Colombo
 *       - in: query
 *         name: substation
 *         required: false
 *         description: Grid substation name, code, or ID
 *         schema:
 *           type: string
 *         example: Colombo Fort
 *     responses:
 *       200:
 *         description: Successfully retrieved solar installations
 *       500:
 *         description: Failed to retrieve solar installations
 */
router.get("/", async (req, res) => {
    try {
        const { province, district, substation } = req.query;

        let substationIds = null;

        // ---------------------------------------------------------
        // Filter by province
        // ---------------------------------------------------------
        if (province) {
            const provinceDocument = await Province.findOne(
                buildSearchCondition(province)
            );

            if (!provinceDocument) {
                return res.status(200).json({
                    status: "success",
                    count: 0,
                    filters: {
                        province,
                        district: district || null,
                        substation: substation || null
                    },
                    data: []
                });
            }

            const districts = await District.find({
                province: provinceDocument._id
            }).select("_id");

            const districtIds = districts.map((item) => item._id);

            const substations = await GridSubstation.find({
                district: { $in: districtIds }
            }).select("_id");

            substationIds = substations.map((item) => item._id);
        }

        // ---------------------------------------------------------
        // Filter by district
        // ---------------------------------------------------------
        if (district) {
            const districtQuery = buildSearchCondition(district);

            // If province is also supplied, restrict district
            // to the selected province
            if (province) {
                const provinceDocument = await Province.findOne(
                    buildSearchCondition(province)
                );

                if (!provinceDocument) {
                    return res.status(200).json({
                        status: "success",
                        count: 0,
                        filters: {
                            province,
                            district,
                            substation: substation || null
                        },
                        data: []
                    });
                }

                districtQuery.province = provinceDocument._id;
            }

            const districtDocument = await District.findOne(
                districtQuery
            );

            if (!districtDocument) {
                return res.status(200).json({
                    status: "success",
                    count: 0,
                    filters: {
                        province: province || null,
                        district,
                        substation: substation || null
                    },
                    data: []
                });
            }

            const substations = await GridSubstation.find({
                district: districtDocument._id
            }).select("_id");

            const districtSubstationIds = substations.map(
                (item) => item._id
            );

            if (substationIds === null) {
                substationIds = districtSubstationIds;
            } else {
                // Apply intersection when province + district
                // are both supplied
                const districtIdStrings = new Set(
                    districtSubstationIds.map((id) => id.toString())
                );

                substationIds = substationIds.filter((id) =>
                    districtIdStrings.has(id.toString())
                );
            }
        }

        // ---------------------------------------------------------
        // Filter by substation
        // ---------------------------------------------------------
        if (substation) {
            const substationQuery = buildSearchCondition(substation);

            // If district is supplied, restrict substation
            // to the selected district
            if (district) {
                const districtDocument = await District.findOne(
                    buildSearchCondition(district)
                );

                if (!districtDocument) {
                    return res.status(200).json({
                        status: "success",
                        count: 0,
                        filters: {
                            province: province || null,
                            district,
                            substation
                        },
                        data: []
                    });
                }

                substationQuery.district = districtDocument._id;
            }

            const substationDocument = await GridSubstation.findOne(
                substationQuery
            );

            if (!substationDocument) {
                return res.status(200).json({
                    status: "success",
                    count: 0,
                    filters: {
                        province: province || null,
                        district: district || null,
                        substation
                    },
                    data: []
                });
            }

            const selectedSubstationId = substationDocument._id;

            if (substationIds === null) {
                substationIds = [selectedSubstationId];
            } else {
                const exists = substationIds.some(
                    (id) =>
                        id.toString() ===
                        selectedSubstationId.toString()
                );

                substationIds = exists
                    ? [selectedSubstationId]
                    : [];
            }
        }

        // ---------------------------------------------------------
        // Build installation query
        // ---------------------------------------------------------
        const installationQuery = {};

        if (substationIds !== null) {
            installationQuery.gridSubstation = {
                $in: substationIds
            };
        }

        // ---------------------------------------------------------
        // Retrieve installations
        // ---------------------------------------------------------
        const installations = await SolarInstallation.find(
            installationQuery
        )
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
            filters: {
                province: province || null,
                district: district || null,
                substation: substation || null
            },
            data: installations
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            code: "INSTALLATION_FILTER_ERROR",
            message: "Failed to retrieve solar installations",
            detail: error.message
        });
    }
});

/**
 * @swagger
 * /api/installations/{id}:
 *   get:
 *     summary: Get a solar installation by ID
 *     description: Retrieve a single solar installation using its MongoDB ObjectId.
 *     tags: [Installations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the solar installation
 *         schema:
 *           type: string
 *           example: 64f123456789abcdef123456
 *     responses:
 *       200:
 *         description: Successfully retrieved solar installation
 *       400:
 *         description: Invalid installation ID
 *       404:
 *         description: Solar installation not found
 *       500:
 *         description: Failed to retrieve solar installation
 */
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
            code: "INSTALLATION_LOOKUP_ERROR",
            message: "Failed to retrieve solar installation",
            detail: error.message
        });
    }
});

module.exports = router;