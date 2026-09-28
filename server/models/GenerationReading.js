const mongoose = require("mongoose");

const generationReadingSchema = new mongoose.Schema(
    {
        installation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SolarInstallation",
            required: true
        },
        timestamp: {
            type: Date,
            required: true
        },
        powerKw: {
            type: Number,
            required: true,
            min: 0
        },
        cumulativeEnergyKwh: {
            type: Number,
            required: true,
            min: 0
        },
        voltage: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate readings for the same installation and timestamp
generationReadingSchema.index(
    { installation: 1, timestamp: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "GenerationReading",
    generationReadingSchema
);