const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ["national", "provincial", "district"],
            required: true
        },
        province: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Province",
            default: null
        },
        district: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "District",
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);