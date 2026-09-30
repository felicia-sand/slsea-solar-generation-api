const mongoose = require("mongoose");
const SolarInstallation = require("../models/SolarInstallation");

const authorizeInstallationAccess = async (req, res, next) => {
    try {
        // Validate installation ID
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_ID",
                message: "Invalid installation ID",
                detail: "The supplied installation ID is not a valid MongoDB ObjectId"
            });
        }

        // Find installation and load its jurisdiction hierarchy
        const installation = await SolarInstallation.findById(req.params.id)
            .populate({
                path: "gridSubstation",
                populate: {
                    path: "district",
                    populate: {
                        path: "province"
                    }
                }
            });

        if (!installation) {
            return res.status(404).json({
                status: "error",
                code: "INSTALLATION_NOT_FOUND",
                message: "Solar installation not found",
                detail: "The requested solar installation does not exist"
            });
        }

        // National users can access all installations
        if (req.user.role === "national") {
            req.installation = installation;
            return next();
        }

        const district = installation.gridSubstation.district;
        const province = district.province;

        // Provincial users can access installations within their province
        if (req.user.role === "provincial") {
            if (
                !req.user.province ||
                province._id.toString() !== req.user.province.toString()
            ) {
                return res.status(403).json({
                    status: "error",
                    code: "JURISDICTION_FORBIDDEN",
                    message: "Access denied",
                    detail: "You are not authorized to access installations outside your province"
                });
            }

            req.installation = installation;
            return next();
        }

        // District users can access installations within their district
        if (req.user.role === "district") {
            if (
                !req.user.district ||
                district._id.toString() !== req.user.district.toString()
            ) {
                return res.status(403).json({
                    status: "error",
                    code: "JURISDICTION_FORBIDDEN",
                    message: "Access denied",
                    detail: "You are not authorized to access installations outside your district"
                });
            }

            req.installation = installation;
            return next();
        }

        // Any unsupported role is denied
        return res.status(403).json({
            status: "error",
            code: "ROLE_FORBIDDEN",
            message: "Access denied",
            detail: "The user role is not authorized to access this resource"
        });

    } catch (error) {
        return res.status(500).json({
            status: "error",
            code: "AUTHORIZATION_ERROR",
            message: "Failed to verify resource authorization",
            detail: error.message
        });
    }
};

module.exports = authorizeInstallationAccess;