const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./db");

const provinceRoutes = require("./routes/provinceRoutes");
const districtRoutes = require("./routes/districtRoutes");
const substationRoutes = require("./routes/substationRoutes");
const installationRoutes = require("./routes/installationRoutes");
const readingRoutes = require("./routes/readingRoutes");
const authRoutes = require("./routes/authRoutes");

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

// API routes
app.use("/api/provinces", provinceRoutes);
app.use("/api/districts", districtRoutes);
app.use("/api/substations", substationRoutes);
app.use("/api/installations", installationRoutes);
app.use("/api", readingRoutes);

// Authentication routes
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});