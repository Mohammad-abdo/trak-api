import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MightyTaxi Mobile User API',
            version: '1.0.0',
            description: 'Mobile API endpoints for the MightyTaxi app - User side',
        },
        servers: [
            {
                url: 'http://localhost:5001',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token',
                },
            },
            schemas: {
                UserFull: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                        email: { type: 'string' },
                        contactNumber: { type: 'string' },
                        userType: { type: 'string' },
                        status: { type: 'string' },
                        avatar: { type: 'string', nullable: true },
                        latitude: { type: 'string', nullable: true },
                        longitude: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string' },
                        data: { type: 'object' },
                    },
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' },
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Home', description: 'Home screen data' },
            { name: 'Services', description: 'Service selection' },
            { name: 'Booking', description: 'Booking creation and management' },
            { name: 'Offers', description: 'Driver offers and trip tracking' },
            { name: 'My Bookings', description: 'User booking history' },
            { name: 'Wallet', description: 'User wallet operations' },
            { name: 'Profile', description: 'User profile and addresses' },
            { name: 'Static', description: 'Static pages, help, notifications' },
        ],
    },
    apis: ['./routes/user/mobileUserRoutes.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
