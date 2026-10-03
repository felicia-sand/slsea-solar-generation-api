const mongoose = require("mongoose");
const dotenv = require("dotenv");

const connectDB = require("../db");
const User = require("../models/User");

dotenv.config();

const createTestUser = async () => {
    try {
        await connectDB();

        const email = "national.test@example.com";
        const password = "National@12345";

        let user = await User.findOne({ email });

        if (user) {
            user.name = "National Test User";
            user.password = password;
            user.role = "national";
            user.province = null;
            user.district = null;
            user.installation = null;

            await user.save();

            console.log("Existing national test user updated.");
        } else {
            user = await User.create({
                name: "National Test User",
                email,
                password,
                role: "national",
                province: null,
                district: null,
                installation: null
            });

            console.log("National test user created.");
        }

        console.log("\nTest user details:");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log(`Role: ${user.role}`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("Failed to create test user:", error.message);

        await mongoose.connection.close();
        process.exit(1);
    }
};

createTestUser();