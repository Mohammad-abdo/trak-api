import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import prisma from './utils/prisma.js';
import { initializeMQTT } from './utils/mqttService.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import rideRequestRoutes from './routes/rideRequests.js';
import serviceRoutes from './routes/services.js';
import paymentRoutes from './routes/payments.js';
import walletRoutes from './routes/wallets.js';
import notificationRoutes from './routes/notifications.js';
import documentRoutes from './routes/documents.js';
import complaintRoutes from './routes/complaints.js';
import complaintCommentRoutes from './routes/complaintComments.js';
import couponRoutes from './routes/coupons.js';
import promotionRoutes from './routes/promotions.js';
import dashboardRoutes from './routes/dashboard.js';
import adminRoutes from './routes/admin.js';
import driverDocumentRoutes from './routes/driverDocuments.js';
import sosRoutes from './routes/sos.js';
import withdrawRequestRoutes from './routes/withdrawRequests.js';
import additionalFeesRoutes from './routes/additionalFees.js';
import paymentGatewayRoutes from './routes/paymentGateways.js';
import settingRoutes from './routes/settings.js';
import airportRoutes from './routes/airports.js';
import faqRoutes from './routes/faqs.js';
import cancellationRoutes from './routes/cancellations.js';
import referenceRoutes from './routes/references.js';
import manageZoneRoutes from './routes/manageZones.js';
import utilityRoutes from './routes/utilities.js';
import regionRoutes from './routes/regions.js';
import reportRoutes from './routes/reports.js';
import fleetRoutes from './routes/fleets.js';
import dispatchRoutes from './routes/dispatch.js';
import pushNotificationRoutes from './routes/pushNotifications.js';
import surgePriceRoutes from './routes/surgePrices.js';
import roleRoutes from './routes/roles.js';
import permissionRoutes from './routes/permissions.js';
import mailTemplateRoutes from './routes/mailTemplates.js';
import rideSMSRoutes from './routes/rideSMS.js';
import languageListRoutes from './routes/languageLists.js';
import languageWithKeywordRoutes from './routes/languageWithKeywords.js';
import defaultKeywordRoutes from './routes/defaultKeywords.js';
import screenRoutes from './routes/screens.js';
import adminLoginDeviceRoutes from './routes/adminLoginDevices.js';
import adminLoginHistoryRoutes from './routes/adminLoginHistory.js';
import pagesRoutes from './routes/pages.js';
import frontendDataRoutes from './routes/frontendData.js';
import subAdminRoutes from './routes/subAdmin.js';
import customerSupportRoutes from './routes/customerSupport.js';
import supportChatHistoryRoutes from './routes/supportChatHistory.js';
import demandMapRoutes from './routes/demandMap.js';
import invoiceRoutes from './routes/invoices.js';
import bulkOperationsRoutes from './routes/bulkOperations.js';
import placesRoutes from './routes/places.js';
import userNotificationRoutes from './routes/userNotifications.js';
import mqttRoutes from './routes/mqtt.js';
import scheduledRideRoutes from './routes/scheduledRides.js';
import serviceCategoryRoutes from './routes/serviceCategoryRoutes.js';
import vehicleCategoryRoutes from './routes/vehicleCategoryRoutes.js';
import pricingRuleRoutes from './routes/pricingRuleRoutes.js';
import geographicZoneRoutes from './routes/geographicZoneRoutes.js';
import touristTripRoutes from './routes/touristTripRoutes.js';
import categoryFeatureRoutes from './routes/categoryFeatureRoutes.js';
import categoryZoneRoutes from './routes/categoryZoneRoutes.js';
import dedicatedBookingRoutes from './routes/dedicatedBookings.js';
import mobileUserRoutes from './routes/user/mobileUserRoutes.js';
import { registerDedicatedBookingHandlers } from './utils/dedicatedBookingSocket.js';
import { runAutoComplete } from './utils/dedicatedBookingScheduler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Test database connection
prisma.$connect()
  .then(() => console.log('Database connected successfully'))
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ride-requests', rideRequestRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/complaint-comments', complaintCommentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/driver-documents', driverDocumentRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/withdraw-requests', withdrawRequestRoutes);
app.use('/api/additional-fees', additionalFeesRoutes);
app.use('/api/payment-gateways', paymentGatewayRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/airports', airportRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/cancellations', cancellationRoutes);
app.use('/api/references', referenceRoutes);
app.use('/api/manage-zones', manageZoneRoutes);
app.use('/api/utilities', utilityRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/fleets', fleetRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/push-notifications', pushNotificationRoutes);
app.use('/api/surge-prices', surgePriceRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/mail-templates', mailTemplateRoutes);
app.use('/api/ride-sms', rideSMSRoutes);
app.use('/api/language-lists', languageListRoutes);
app.use('/api/language-with-keywords', languageWithKeywordRoutes);
app.use('/api/default-keywords', defaultKeywordRoutes);
app.use('/api/screens', screenRoutes);
app.use('/api/admin-login-devices', adminLoginDeviceRoutes);
app.use('/api/admin-login-history', adminLoginHistoryRoutes);
app.use('/api/pages', pagesRoutes);
app.use('/api/frontend-data', frontendDataRoutes);
app.use('/api/sub-admin', subAdminRoutes);
app.use('/api/customer-support', customerSupportRoutes);
app.use('/api/support-chat-history', supportChatHistoryRoutes);
app.use('/api/demand-map', demandMapRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/bulk-operations', bulkOperationsRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/user-notifications', userNotificationRoutes);
app.use('/api/mqtt', mqttRoutes);
app.use('/api/rides', scheduledRideRoutes);

// Multi-Service Platform Routes
app.use('/api/service-categories', serviceCategoryRoutes);
app.use('/api/vehicle-categories', vehicleCategoryRoutes);
app.use('/api/pricing-rules', pricingRuleRoutes);
app.use('/api/geographic-zones', geographicZoneRoutes);
app.use('/api/tourist-trips', touristTripRoutes);
app.use('/api/category-features', categoryFeatureRoutes);
app.use('/api/category-zones', categoryZoneRoutes);
app.use('/api/dedicated-bookings', dedicatedBookingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Mobile User API Routes
app.use('/apimobile/user', mobileUserRoutes);

// Swagger UI (optional – only if packages installed)
try {
  const swaggerUiModule = await import('swagger-ui-express');
  const swaggerJsdocModule = await import('swagger-jsdoc');
  const swaggerUi = swaggerUiModule.default;
  const swaggerJsdoc = swaggerJsdocModule.default;

  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: { title: 'OFFER_GO Mobile User API', version: '1.0.0', description: 'Mobile API for the OFFER_GO app – User side' },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
        schemas: {
          UserFull: {
            type: 'object',
            properties: {
              id:            { type: 'integer', example: 1 },
              firstName:     { type: 'string',  example: 'Mohamed' },
              lastName:      { type: 'string',  example: 'Ahmed' },
              email:         { type: 'string',  example: 'user@mail.com' },
              contactNumber: { type: 'string',  example: '01234567890' },
              countryCode:   { type: 'string',  example: '+20' },
              userType:      { type: 'string',  example: 'rider' },
              status:        { type: 'string',  example: 'active' },
              avatar:        { type: 'string',  nullable: true },
              gender:        { type: 'string',  nullable: true },
              address:       { type: 'string',  nullable: true },
              latitude:      { type: 'string',  nullable: true },
              longitude:     { type: 'string',  nullable: true },
              isOnline:      { type: 'boolean', example: false },
              isAvailable:   { type: 'boolean', example: true },
              referralCode:  { type: 'string',  example: 'USR1234567890' },
              createdAt:     { type: 'string',  format: 'date-time' },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Auth', description: 'Authentication' },
        { name: 'Home', description: 'Home screen' },
        { name: 'Services', description: 'Service selection' },
        { name: 'Booking', description: 'Booking' },
        { name: 'Offers', description: 'Driver offers & trip tracking' },
        { name: 'My Bookings', description: 'User booking history' },
        { name: 'Wallet', description: 'Wallet' },
        { name: 'Profile', description: 'Profile & addresses' },
        { name: 'Static', description: 'Static pages & notifications' },
      ],
    },
    apis: ['./routes/user/mobileUserRoutes.js'],
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  // Serve swagger spec dynamically so the server URL always matches the current host
  app.get('/api-docs/swagger.json', (req, res) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const dynamicSpec = {
      ...swaggerSpec,
      servers: [{ url: `${proto}://${host}`, description: 'Current server' }],
    };
    res.json(dynamicSpec);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: { url: '/api-docs/swagger.json' },
  }));
  console.log(`📚 Swagger UI available at /api-docs`);
} catch (e) {
  console.warn('⚠️  Swagger UI not available. Run: npm install swagger-jsdoc swagger-ui-express');
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join user-specific room
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Join driver room
  socket.on('join-driver-room', (driverId) => {
    socket.join(`driver-${driverId}`);
    console.log(`Driver ${driverId} joined their room`);
  });

  // Handle ride request updates
  socket.on('subscribe-ride', (rideId) => {
    socket.join(`ride-${rideId}`);
    console.log(`Subscribed to ride ${rideId}`);
  });

  registerDedicatedBookingHandlers(socket, io);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available globally for use in controllers and scheduled services
app.set('io', io);
global.io = io;

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Initialize MQTT on server start
if (process.env.MQTT_HOST) {
  initializeMQTT();
}

// Initialize scheduled ride activation service
import cron from 'node-cron';
import { activateScheduledRides } from './utils/scheduledRideService.js';

// Start scheduled ride activation cron job
cron.schedule('* * * * *', async () => {
  try {
    await activateScheduledRides();
  } catch (error) {
    console.error('Error in scheduled ride activation cron job:', error);
  }
});

// Dedicated booking auto-complete: ACTIVE -> COMPLETED when startedAt + duration exceeded
cron.schedule('* * * * *', async () => {
  try {
    await runAutoComplete();
  } catch (error) {
    console.error('Error in dedicated booking auto-complete:', error);
  }
});

console.log('Scheduled ride activation and dedicated booking auto-complete running (every minute)');

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO server is ready`);
  if (process.env.MQTT_HOST) {
    console.log(`MQTT service initialized`);
  }
  console.log(`Scheduled ride activation service is running`);
});

