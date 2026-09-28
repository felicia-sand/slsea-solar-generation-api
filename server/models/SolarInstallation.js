const mongoose = require("mongoose");

const solarInstallationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        installationId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },
        meterId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        inverterId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        capacityKw: {
            type: Number,
            required: true,
            min: 0
        },
        gridSubstation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GridSubstation",
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "SolarInstallation",
    solarInstallationSchema
);