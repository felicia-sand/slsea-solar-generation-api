const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./db");
const Province = require("./models/Province");

dotenv.config();

const app = express();

app.use(express.json());

// Connect to MongoDB
connectDB();

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "SLSEA Solar Generation API is running"
    });
});

// Test Province creation
app.post("/api/provinces/test", async (req, res) => {
    try {
        const province = await Province.create({
            name: req.body.name,
            code: req.body.code
        });

        res.status(201).json({
            status: "success",
            data: province
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});