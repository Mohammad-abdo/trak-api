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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

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
// Runs every minute to check for rides that need activation
cron.schedule('* * * * *', async () => {
  try {
    await activateScheduledRides();
  } catch (error) {
    console.error('Error in scheduled ride activation cron job:', error);
  }
});

console.log('Scheduled ride activation service started (runs every minute)');

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO server is ready`);
  if (process.env.MQTT_HOST) {
    console.log(`MQTT service initialized`);
  }
  console.log(`Scheduled ride activation service is running`);
});

