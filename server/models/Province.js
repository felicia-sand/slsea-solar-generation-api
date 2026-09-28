const mongoose = require("mongoose");

const provinceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Province", provinceSchema);