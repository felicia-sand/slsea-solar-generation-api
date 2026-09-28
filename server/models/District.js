const mongoose = require("mongoose");

const districtSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },
        province: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Province",
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("District", districtSchema);