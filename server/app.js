const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./db");

dotenv.config();

const app = express();

app.use(express.json());

// Connect to MongoDB
connectDB();

app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "SLSEA Solar Generation API is running"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});