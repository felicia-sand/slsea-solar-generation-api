const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.0",

        info: {
            title: "SLSEA Solar Generation API",
            version: "1.0.0",
            description:
                "REST API for managing real-time solar generation data for the Sri Lanka Sustainable Energy Authority"
        },

        servers: [
            {
                url: "http://localhost:5000",
                description: "Local development server"
            }
        ],

        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            }
        },

        tags: [
            {
                name: "Authentication",
                description: "User authentication endpoints"
            },
            {
                name: "Provinces",
                description: "Province resource endpoints"
            },
            {
                name: "Districts",
                description: "District resource endpoints"
            },
            {
                name: "Substations",
                description: "Grid substation resource endpoints"
            },
            {
                name: "Installations",
                description: "Solar installation resource endpoints"
            },
            {
                name: "Generation Readings",
                description: "Solar generation reading endpoints"
            }
        ]
    },

    apis: [
        "./routes/*.js"
    ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;