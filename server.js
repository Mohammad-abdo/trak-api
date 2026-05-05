import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
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
import paymentMethodsRoutes from './routes/paymentMethods.js';
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
import adminNotificationRoutes from './routes/adminNotifications.js';
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
import negotiationRoutes from './routes/negotiations.js';
import rideChatRoutes from './routes/rideChat.js';
import mobileUserRoutes from './routes/user/mobileUserRoutes.js';
import mobileDriverRoutes from './routes/driver/mobileDriverRoutes.js';
import { registerDedicatedBookingHandlers } from './utils/dedicatedBookingSocket.js';
import { registerRideChatHandlers } from './utils/rideChatSocket.js';
import { runAutoComplete } from './utils/dedicatedBookingScheduler.js';
import { requestContextMiddleware } from './middleware/requestContext.js';
import { securityAuditMiddleware } from './middleware/securityAuditMiddleware.js';
import { createIpRateLimiter, getHardeningConfigFromEnv, publicUploadsResourcePolicy, securityHeaders } from './middleware/securityHardening.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.disable('x-powered-by');

function parseAllowedOrigins() {
  const envOrigins = String(process.env.FRONTEND_URL || '').trim();
  if (!envOrigins) return '*';
  if (envOrigins === '*') return '*';
  const origins = envOrigins
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return origins.length ? origins : '*';
}

const httpServer = createServer(app);

// ─── Socket.IO server config (env-driven for production) ────────────────────
// - Set SOCKET_PATH if your reverse proxy mounts the socket under a subpath.
// - Set SOCKET_TRANSPORTS to "polling,websocket" to force-start with polling
//   behind proxies that struggle with the upgrade (not recommended unless
//   needed; defaults to allowing both).
// - FRONTEND_URL is a comma-separated allow-list (no trailing slashes).
const SOCKET_PATH = process.env.SOCKET_PATH && process.env.SOCKET_PATH.trim()
  ? process.env.SOCKET_PATH.trim()
  : '/socket.io';
const SOCKET_TRANSPORTS = (process.env.SOCKET_TRANSPORTS || 'websocket,polling')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const SOCKET_PING_INTERVAL = parseInt(process.env.SOCKET_PING_INTERVAL || '25000', 10);
const SOCKET_PING_TIMEOUT = parseInt(process.env.SOCKET_PING_TIMEOUT || '60000', 10);

const allowedOrigins = parseAllowedOrigins();
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: allowedOrigins !== '*',
  },
  path: SOCKET_PATH,
  transports: SOCKET_TRANSPORTS,
  pingInterval: SOCKET_PING_INTERVAL,
  pingTimeout: SOCKET_PING_TIMEOUT,
  allowEIO3: true,
});

console.log(
  `📡 Socket.IO ready: path=${SOCKET_PATH} transports=${SOCKET_TRANSPORTS.join(',')} ` +
  `origin=${Array.isArray(allowedOrigins) ? allowedOrigins.join(',') : allowedOrigins}`
);
const PORT = process.env.PORT || 5000;
const hardeningConfig = getHardeningConfigFromEnv();
const socketAuthEnforced = process.env.SOCKET_ENFORCE_AUTH === '1';
const authRateLimiter = createIpRateLimiter({
  enabled: hardeningConfig.authLimiterEnabled,
  windowMs: hardeningConfig.authRateWindowMs,
  maxRequests: hardeningConfig.authRateMax,
});

function extractSocketToken(socket) {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.replace(/^Bearer\s+/i, '').trim();
  }
  const headerToken = socket.handshake?.headers?.authorization;
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.replace(/^Bearer\s+/i, '').trim();
  }
  const queryToken = socket.handshake?.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.replace(/^Bearer\s+/i, '').trim();
  }
  return null;
}

async function resolveSocketUser(socket) {
  const token = extractSocketToken(socket);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        userType: true,
        status: true,
      },
    });
    return user || null;
  } catch (_) {
    return null;
  }
}

function parseTrustProxy() {
  const v = process.env.TRUST_PROXY;
  if (v === undefined || v === '' || v === '0' || v === 'false') return false;
  if (v === '1' || v === 'true') return true;
  const n = parseInt(v, 10);
  if (!Number.isNaN(n) && String(n) === String(v).trim()) return n;
  return true;
}

app.set('trust proxy', parseTrustProxy());

// Middleware
app.use(requestContextMiddleware);
app.use(cors());
app.use(securityHeaders);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(securityAuditMiddleware);

// Conservative limiter for auth/otp/password endpoints.
// Does not change normal API responses unless an IP is abusive.
app.use(['/api/auth', '/apimobile/user/auth', '/apimobile/driver/auth'], authRateLimiter);

// Static files — CORP must allow cross-origin so dashboard (e.g. Vercel) can load images from API host
app.use('/uploads', publicUploadsResourcePolicy);
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
app.use('/api/payment-methods', paymentMethodsRoutes);
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
app.use('/api/admin-notifications', adminNotificationRoutes);
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
app.use('/api/negotiations', negotiationRoutes);

// Ride chat (rider <-> driver, available after ride acceptance)
app.use('/apimobile/chat', rideChatRoutes);

// Site root (GET /) — proves the API host responds (DNS/SSL/load balancer checks)
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'OfferGo API',
    status: 'OK',
    message: 'Backend is running.',
    apiIndex: '/api',
    health: '/api/health',
    timestamp: new Date().toISOString(),
  });
});

// Root under /api (GET /api) — avoids "Cannot GET /api"; use for health / baseUrl checks
app.get('/api', (req, res) => {
  res.json({
    success: true,
    service: 'OfferGo API',
    message: 'Use the health paths below for probes.',
    endpoints: {
      root: '/',
      health: '/api/health',
      healthLive: '/api/health/live',
      healthReady: '/api/health/ready',
      healthSocket: '/api/health/socket',
      mobileUser: '/apimobile/user',
      mobileDriver: '/apimobile/driver',
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

async function probeEngineIoPolling(baseUrl) {
  const url = `${baseUrl}${SOCKET_PATH}/?EIO=4&transport=polling`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: '*/*' } });
    const text = await r.text();
    const valid = r.ok && typeof text === 'string' && text.length > 0 && /^[0-6]/.test(text[0]);
    return { ok: valid, url, httpStatus: r.status, enginePrefix: text.slice(0, 48) };
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'timeout' : String(e?.message || e);
    return { ok: false, url, error: msg };
  } finally {
    clearTimeout(t);
  }
}

// Socket.IO health: config + live counts + Engine.IO polling probes (HTTP layer of Socket.IO).
// A real WebSocket upgrade must still be tested from the app/browser; see `clientHint`.
app.get('/api/health/socket', async (req, res) => {
  let connectedClients = null;
  let namespaceSockets = null;
  try {
    connectedClients = typeof io.engine?.clientsCount === 'number' ? io.engine.clientsCount : null;
  } catch (_) {
    connectedClients = null;
  }
  try {
    namespaceSockets = typeof io.of('/').sockets?.size === 'number' ? io.of('/').sockets.size : null;
  } catch (_) {
    namespaceSockets = null;
  }

  const port = Number(process.env.PORT) || 5000;
  const localProbe = await probeEngineIoPolling(`http://127.0.0.1:${port}`);

  let publicProbe = null;
  try {
    const host = req.get('host');
    if (host) {
      const xfProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
      const scheme = xfProto === 'https' || req.secure ? 'https' : 'http';
      publicProbe = await probeEngineIoPolling(`${scheme}://${host}`);
    }
  } catch (_) {
    publicProbe = { ok: false, error: 'public_probe_failed' };
  }

  const engineReachable = Boolean(localProbe?.ok || publicProbe?.ok);
  const status = engineReachable ? 'OK' : 'DEGRADED';

  // Always HTTP 200 so uptime checks still parse JSON; use `engineReachable` / `status` for logic.
  res.json({
    status,
    socketServer: 'initialized',
    engineReachable,
    connectedClients,
    namespaceSockets,
    path: SOCKET_PATH,
    transports: SOCKET_TRANSPORTS,
    allowedOrigins,
    handshakeProbeUrl: `${SOCKET_PATH}/?EIO=4&transport=polling`,
    probes: {
      local: localProbe,
      public: publicProbe,
    },
    clientHint:
      'Use socket.io-client with the same base URL, path option matching `path`, and JWT in auth/handshake. ' +
      'If `public.ok` is false behind nginx, check proxy_pass for /socket.io/ and WebSocket upgrade headers.',
  });
});

// Liveness probe: process is up
app.get('/api/health/live', (req, res) => {
  res.json({ status: 'OK', message: 'Server is live' });
});

// Readiness probe: dependencies are reachable
app.get('/api/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'OK', message: 'Server is ready' });
  } catch (error) {
    return res.status(503).json({ status: 'NOT_READY', message: 'Database not reachable' });
  }
});

// Mobile User API Routes
app.use('/apimobile/user', mobileUserRoutes);

// Mobile Driver API Routes
app.use('/apimobile/driver', mobileDriverRoutes);

// Swagger UI (optional – only if packages installed)
try {
  const swaggerUiModule = await import('swagger-ui-express');
  const swaggerJsdocModule = await import('swagger-jsdoc');
  const swaggerUi = swaggerUiModule.default;
  const swaggerJsdoc = swaggerJsdocModule.default;  

  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'OFFER_GO Mobile User API',
        version: '1.0.0',
        description: `Mobile API for the OFFER_GO app – User side.

**Test user (after running \`npm run prisma:seed\`):**
- **Phone:** \`01234567890\`
- **Password:** \`Test1234\`
- Get token: **POST** \`/apimobile/user/auth/login\` with body: \`{ "phone": "01234567890", "password": "Test1234" }\`
- Use the returned \`data.token\` in **Authorization: Bearer <token>** for all protected endpoints.
- This user has: wallet (350 SAR), 2 addresses, 2 saved cards, bookings, wallet history, notifications.`,
      },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
        schemas: {
          RideChatMessage: {
            type: 'object',
            properties: {
              id:            { type: 'integer', example: 184 },
              rideRequestId: { type: 'integer', example: 921 },
              senderId:      { type: 'integer', example: 12 },
              senderType:    { type: 'string',  enum: ['rider', 'driver'], example: 'rider' },
              message:       { type: 'string',  example: 'I am waiting at the main gate, blue shirt.' },
              attachmentUrl: { type: 'string',  nullable: true, example: null },
              isRead:        { type: 'boolean', example: false },
              readAt:        { type: 'string',  format: 'date-time', nullable: true, example: null },
              createdAt:     { type: 'string',  format: 'date-time', example: '2026-04-18T12:45:03.512Z' },
            },
          },
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
              isVerified:    { type: 'boolean', example: true, description: 'Must be true to login; verify via submit-otp' },
              createdAt:     { type: 'string',  format: 'date-time' },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Auth', description: 'Authentication & verification. Login returns 403 if account not verified. Use resend-otp (with token or by phone) or send-otp (with token) then submit-otp to verify.' },
        { name: 'Home', description: 'Home screen' },
        { name: 'Services', description: 'Service selection' },
        { name: 'Booking', description: 'Booking' },
        { name: 'Offers', description: 'Driver offers & trip tracking' },
        { name: 'My Bookings', description: 'User booking history' },
        { name: 'Wallet', description: 'Wallet' },
        { name: 'Profile', description: 'Profile & addresses' },
        { name: 'Cards', description: 'Saved payment cards (add, list, delete)' },
        { name: 'Mobile Dedicated Bookings', description: 'Dedicated/private booking endpoints for the mobile app: pricing, create booking, booking history, invoice, driver availability/acceptance, and lifecycle actions.' },
        { name: 'Static', description: 'Static pages & notifications' },
        { name: 'Negotiation', description: 'Ride fare negotiation between rider & driver (up to ±20%). Feature must be enabled in Settings.' },
        { name: 'Ride Chat', description: '1-to-1 chat between rider and the assigned driver. Enabled after the driver accepts the trip (status = accepted/arrived/started/ongoing/in_progress). History stays readable after the trip ends.' },
      ],
    },
    apis: ['./routes/user/mobileUserRoutes.js', './routes/dedicatedBookings.js', './routes/rideChat.js'],
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

  app.use('/api-docs', swaggerUi.serveFiles(swaggerSpec, {}), swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: { url: '/api-docs/swagger.json' },
  }));
  console.log(`📚 Swagger UI (User) available at /api-docs`);

  // ── Driver Swagger ──
  const driverSwaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'OFFER_GO Mobile Driver API',
        version: '1.0.0',
        description: `Mobile API for the OFFER_GO app – **Driver side**.

**Registration flow:**
1. **GET** \`/apimobile/driver/documents/required\` — get list of document types to show in the registration form.
2. **POST** \`/apimobile/driver/auth/register\` — send all driver data + vehicle + documents as multipart/form-data.
3. **POST** \`/apimobile/driver/auth/submit-otp\` — verify phone with OTP (use token from register).
4. **Wait for admin approval** — driver status starts as \`pending\`. Use \`GET /apimobile/driver/profile/status\` to check.
5. Once admin sets status = \`active\`, driver can **login** and start driving.`,
      },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
        schemas: {
          RideChatMessage: {
            type: 'object',
            properties: {
              id:            { type: 'integer', example: 185 },
              rideRequestId: { type: 'integer', example: 921 },
              senderId:      { type: 'integer', example: 47 },
              senderType:    { type: 'string',  enum: ['rider', 'driver'], example: 'driver' },
              message:       { type: 'string',  example: 'On my way, 3 minutes.' },
              attachmentUrl: { type: 'string',  nullable: true, example: null },
              isRead:        { type: 'boolean', example: false },
              readAt:        { type: 'string',  format: 'date-time', nullable: true, example: null },
              createdAt:     { type: 'string',  format: 'date-time', example: '2026-04-18T12:45:17.004Z' },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Driver Auth', description: 'Registration (full details + vehicle + docs), login, OTP, logout' },
        { name: 'Driver Profile', description: 'Get/update profile, registration status, bank account' },
        { name: 'Driver Cards', description: 'Add/list/delete saved bank cards (last 4 digits + metadata only)' },
        { name: 'Driver Vehicle', description: 'Update vehicle information and image' },
        { name: 'Driver Documents', description: 'Upload and manage driver documents/licenses' },
        { name: 'Driver Status', description: 'Online/offline, availability, GPS location updates' },
        { name: 'Driver Rides', description: 'Core ride operations: accept/reject, arrive, start, complete, cancel, rate, bid' },
        { name: 'Mobile Dedicated Bookings', description: 'Dedicated/private booking endpoints relevant to drivers: available bookings, accept booking, start/end/cancel, details, and invoice.' },
        { name: 'Driver Ratings', description: 'View ratings received from riders' },
        { name: 'Driver Wallet', description: 'Wallet balance, transaction history, earnings summary, withdrawals' },
        { name: 'Driver Complaints', description: 'File and view complaints' },
        { name: 'Driver Negotiation', description: 'Fare negotiation: counter-offer, accept, reject, history' },
        { name: 'Driver Notifications', description: 'Push notifications: list, mark read' },
        { name: 'Driver Static', description: 'Privacy policy, terms, help center' },
        { name: 'Ride Chat', description: '1-to-1 chat with the assigned rider. Enabled once you accept the trip (status = accepted/arrived/started/ongoing/in_progress). History stays readable after the trip ends.' },
      ],
    },
    apis: ['./routes/driver/mobileDriverRoutes.js', './routes/dedicatedBookings.js', './routes/rideChat.js'],
  };

  const driverSwaggerSpec = swaggerJsdoc(driverSwaggerOptions);

  app.get('/api-docs-driver/swagger.json', (req, res) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    res.json({
      ...driverSwaggerSpec,
      servers: [{ url: `${proto}://${host}`, description: 'Current server' }],
    });
  });

  app.use('/api-docs-driver', swaggerUi.serveFiles(driverSwaggerSpec, {}), swaggerUi.setup(driverSwaggerSpec, {
    explorer: true,
    swaggerOptions: { url: '/api-docs-driver/swagger.json' },
  }));
  console.log(`📚 Swagger UI (Driver) available at /api-docs-driver`);
} catch (e) {
  console.warn('⚠️  Swagger UI not available. Run: npm install swagger-jsdoc swagger-ui-express');
}

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  const socketUser = await resolveSocketUser(socket);
  if (socketUser) {
    socket.data.user = socketUser;
    // Auto-join rooms so mobile apps receive emits even if the client never sends
    // `join-user-room` / `join-driver-room` (backend-only contract fix).
    if (socketUser.status === 'active') {
      socket.join(`user-${socketUser.id}`);
      const ut = String(socketUser.userType || '').toLowerCase();
      if (ut === 'driver') {
        socket.join(`driver-${socketUser.id}`);
      }
    }
  } else if (socketAuthEnforced) {
    socket.emit('socket-auth-error', { success: false, message: 'Socket authentication required' });
    socket.disconnect(true);
    return;
  }

  // Join user-specific room
  socket.on('join-user-room', (userId) => {
    if (socketAuthEnforced) {
      const currentUser = socket.data.user;
      if (!currentUser || Number(userId) !== Number(currentUser.id)) {
        socket.emit('socket-auth-error', { success: false, message: 'Not authorized for user room' });
        return;
      }
    }
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Join driver room
  socket.on('join-driver-room', (driverId) => {
    if (socketAuthEnforced) {
      const currentUser = socket.data.user;
      if (!currentUser || currentUser.userType !== 'driver' || Number(driverId) !== Number(currentUser.id)) {
        socket.emit('socket-auth-error', { success: false, message: 'Not authorized for driver room' });
        return;
      }
    }
    socket.join(`driver-${driverId}`);
    console.log(`Driver ${driverId} joined their room`);
  });

  // Handle ride request updates
  socket.on('subscribe-ride', async (rideId) => {
    if (socketAuthEnforced) {
      const currentUser = socket.data.user;
      if (!currentUser) {
        socket.emit('socket-auth-error', { success: false, message: 'Authentication required' });
        return;
      }

      const rideIdInt = parseInt(String(rideId), 10);
      if (Number.isNaN(rideIdInt)) {
        socket.emit('socket-auth-error', { success: false, message: 'Invalid ride id' });
        return;
      }

      // Admin/staff can subscribe to any ride; riders/drivers only to their own rides.
      const isPrivileged = !['rider', 'driver'].includes(currentUser.userType);
      if (!isPrivileged) {
        const ride = await prisma.rideRequest.findUnique({
          where: { id: rideIdInt },
          select: { riderId: true, driverId: true },
        });
        const allowed =
          !!ride &&
          (Number(ride.riderId) === Number(currentUser.id) || Number(ride.driverId) === Number(currentUser.id));
        if (!allowed) {
          socket.emit('socket-auth-error', { success: false, message: 'Not authorized for ride room' });
          return;
        }
      }
    }
    socket.join(`ride-${rideId}`);
    console.log(`Subscribed to ride ${rideId}`);
  });

  socket.on('unsubscribe-ride', (rideId) => {
    const rideIdInt = parseInt(String(rideId), 10);
    if (!Number.isNaN(rideIdInt)) {
      socket.leave(`ride-${rideIdInt}`);
    }
  });

  registerDedicatedBookingHandlers(socket, io);
  registerRideChatHandlers(socket, io);

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
const serverInstance = httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO server is ready`);
  if (process.env.MQTT_HOST) {
    console.log(`MQTT service initialized`);
  }
  console.log(`Scheduled ride activation service is running`);
});

let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully...`);

  serverInstance.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('Database disconnected');
    } catch (err) {
      console.error('Error during Prisma disconnect:', err);
    } finally {
      process.exit(0);
    }
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

