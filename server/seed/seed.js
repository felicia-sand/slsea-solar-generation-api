const mongoose = require("mongoose");
const dotenv = require("dotenv");

const connectDB = require("../db");

const Province = require("../models/Province");
const District = require("../models/District");
const GridSubstation = require("../models/GridSubstation");
const SolarInstallation = require("../models/SolarInstallation");
const GenerationReading = require("../models/GenerationReading");

dotenv.config();

const provinceData = [
    {
        name: "Western Province",
        code: "WP",
        districts: [
            { name: "Colombo", code: "CMB" },
            { name: "Gampaha", code: "GMP" },
            { name: "Kalutara", code: "KLT" }
        ]
    },
    {
        name: "Central Province",
        code: "CP",
        districts: [
            { name: "Kandy", code: "KDY" },
            { name: "Matale", code: "MTL" },
            { name: "Nuwara Eliya", code: "NEL" }
        ]
    },
    {
        name: "Southern Province",
        code: "SP",
        districts: [
            { name: "Galle", code: "GAL" },
            { name: "Matara", code: "MTR" },
            { name: "Hambantota", code: "HMB" }
        ]
    },
    {
        name: "Northern Province",
        code: "NP",
        districts: [
            { name: "Jaffna", code: "JAF" },
            { name: "Kilinochchi", code: "KIL" },
            { name: "Mannar", code: "MNR" },
            { name: "Mullaitivu", code: "MLT" },
            { name: "Vavuniya", code: "VAV" }
        ]
    },
    {
        name: "Eastern Province",
        code: "EP",
        districts: [
            { name: "Batticaloa", code: "BAT" },
            { name: "Ampara", code: "AMP" },
            { name: "Trincomalee", code: "TRI" }
        ]
    },
    {
        name: "North Western Province",
        code: "NWP",
        districts: [
            { name: "Kurunegala", code: "KUR" },
            { name: "Puttalam", code: "PUT" }
        ]
    },
    {
        name: "North Central Province",
        code: "NCP",
        districts: [
            { name: "Anuradhapura", code: "ANU" },
            { name: "Polonnaruwa", code: "POL" }
        ]
    },
    {
        name: "Uva Province",
        code: "UP",
        districts: [
            { name: "Badulla", code: "BAD" },
            { name: "Monaragala", code: "MON" }
        ]
    },
    {
        name: "Sabaragamuwa Province",
        code: "SGP",
        districts: [
            { name: "Ratnapura", code: "RAT" },
            { name: "Kegalle", code: "KEG" }
        ]
    }
];

const createSeedData = async () => {
    try {
        await connectDB();

        console.log("Clearing existing seed data...");

        await GenerationReading.deleteMany({});
        await SolarInstallation.deleteMany({});
        await GridSubstation.deleteMany({});
        await District.deleteMany({});
        await Province.deleteMany({});

        console.log("Creating provinces and districts...");

        const createdProvinces = [];
        const createdDistricts = [];

        for (const provinceInfo of provinceData) {
            const province = await Province.create({
                name: provinceInfo.name,
                code: provinceInfo.code
            });

            createdProvinces.push(province);

            for (const districtInfo of provinceInfo.districts) {
                const district = await District.create({
                    name: districtInfo.name,
                    code: districtInfo.code,
                    province: province._id
                });

                createdDistricts.push(district);
            }
        }

        console.log(`Created ${createdProvinces.length} provinces`);
        console.log(`Created ${createdDistricts.length} districts`);

        console.log("Creating grid substations...");

        const createdSubstations = [];

        for (const district of createdDistricts) {
            const substation = await GridSubstation.create({
                name: `${district.name} Grid Substation`,
                code: `GS-${district.code}`,
                district: district._id
            });

            createdSubstations.push(substation);
        }

        console.log(`Created ${createdSubstations.length} grid substations`);

        console.log("Creating solar installations...");

        const createdInstallations = [];

        for (let i = 0; i < 200; i++) {
            const substation = createdSubstations[i % createdSubstations.length];

            const installation = await SolarInstallation.create({
                name: `Solar Installation ${String(i + 1).padStart(3, "0")}`,
                installationId: `SOL-${String(i + 1).padStart(4, "0")}`,
                meterId: `MTR-${String(i + 1).padStart(5, "0")}`,
                inverterId: `INV-${String(i + 1).padStart(5, "0")}`,
                capacityKw: 5 + (i % 6) * 5,
                gridSubstation: substation._id
            });

            createdInstallations.push(installation);
        }

        console.log(`Created ${createdInstallations.length} solar installations`);

        console.log("Creating generation readings...");

        const readings = [];

        const intervalMinutes = 15;
        const days = 7;
        const readingsPerDay = (24 * 60) / intervalMinutes;

        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - days);

        for (const installation of createdInstallations) {
            let cumulativeEnergy = 0;

            for (let day = 0; day < days; day++) {
                for (let interval = 0; interval < readingsPerDay; interval++) {
                    const timestamp = new Date(startDate);

                    timestamp.setDate(startDate.getDate() + day);
                    timestamp.setMinutes(interval * intervalMinutes);

                    const hour =
                        timestamp.getHours() +
                        timestamp.getMinutes() / 60;

                    let powerKw = 0;

                    // Solar generation between approximately 6 AM and 6 PM
                    if (hour >= 6 && hour <= 18) {
                        const solarProgress = (hour - 6) / 12;

                        // Diurnal solar curve
                        const curve = Math.sin(Math.PI * solarProgress);

                        // Small variation between installations/readings
                        const variation =
                            0.85 + Math.random() * 0.15;

                        powerKw =
                            installation.capacityKw *
                            curve *
                            variation;
                    }

                    powerKw = Math.max(0, Number(powerKw.toFixed(2)));

                    // Approximate energy generated during this 15-minute interval
                    const energyGenerated =
                        powerKw * (intervalMinutes / 60);

                    cumulativeEnergy += energyGenerated;

                    const voltage =
                        225 + Math.random() * 10;

                    readings.push({
                        installation: installation._id,
                        timestamp,
                        powerKw,
                        cumulativeEnergyKwh:
                            Number(cumulativeEnergy.toFixed(3)),
                        voltage: Number(voltage.toFixed(2))
                    });
                }
            }
        }

        console.log(`Preparing ${readings.length} generation readings...`);

        // Insert readings in batches to avoid a very large single database operation
        const batchSize = 5000;

        for (let i = 0; i < readings.length; i += batchSize) {
            const batch = readings.slice(i, i + batchSize);
            await GenerationReading.insertMany(batch);
            console.log(
                `Inserted readings ${Math.min(
                    i + batchSize,
                    readings.length
                )} / ${readings.length}`
            );
        }

        console.log("\nSeed completed successfully!");
        console.log(`Provinces: ${createdProvinces.length}`);
        console.log(`Districts: ${createdDistricts.length}`);
        console.log(`Substations: ${createdSubstations.length}`);
        console.log(`Installations: ${createdInstallations.length}`);
        console.log(`Readings: ${readings.length}`);

        await mongoose.connection.close();

        process.exit(0);
    } catch (error) {
        console.error("Seed failed:", error.message);

        await mongoose.connection.close();

        process.exit(1);
    }
};

createSeedData();