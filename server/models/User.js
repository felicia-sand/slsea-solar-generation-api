const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
            required: true,
            minlength: 8
        },

        role: {
            type: String,
            enum: ["national", "provincial", "district", "device"],
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
        },

        installation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SolarInstallation",
            default: null
        }
    },
    { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model("User", userSchema);