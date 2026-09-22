const express = require("express");

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "SLSEA Solar Generation API is running"
    });
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});