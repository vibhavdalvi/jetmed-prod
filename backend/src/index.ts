import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { getCorsAllowedOrigins, isOriginAllowed } from './config/index.js';
import mongoose, { connectMongoDB } from './config/mongodb.js';
import { connectRedis, getRedisClient } from './config/redis.js';
import { checkServicesHealth } from './services/index.js';
// Elasticsearch optional — medicine search falls back to MongoDB queries

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import medicineRoutes from './routes/medicines.js';
import orderRoutes from './routes/orders.js';
import prescriptionRoutes from './routes/prescriptions.js';
import paymentRoutes, { stripeWebhookHandler } from './routes/payments.js';
import pharmacistRoutes from './routes/pharmacist.js';
import deliveryRoutes from './routes/delivery.js';
import warehouseRoutes from './routes/warehouse.js';
import adminRoutes from './routes/admin.js';
import searchRoutes from './routes/search.js';
import communicationRoutes from './routes/communication.js';
import smsRoutes from './routes/smsRoutes.js';

// Import socket handler
import { setupSocketIO } from './services/socket.js';

// Import error handler
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import Swagger docs
import { setupSwagger } from './config/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app: Express = express();
// Render/Railway set X-Forwarded-For; required for correct client IP + express-rate-limit.
// Default `1` = trust one proxy hop (typical LB). Boolean `true` trips express-rate-limit
// ERR_ERL_PERMISSIVE_TRUST_PROXY. Use TRUST_PROXY=false locally; TRUST_PROXY=N for N hops.
if (process.env.TRUST_PROXY === 'false') {
  app.set('trust proxy', false);
} else if (process.env.TRUST_PROXY && /^\d+$/.test(process.env.TRUST_PROXY)) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY, 10));
} else {
  app.set('trust proxy', 1);
}
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
      cb(null, isOriginAllowed(origin));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Setup Socket.IO handlers
setupSocketIO(io);

// Make io accessible to routes
app.set('io', io);

const apiVersion = `/api/${config.app.apiVersion}`;

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Pharmacist/customer apps run on a different origin than the API; uploads must be embeddable in <iframe> for PDF Rx review.
  frameguard: false,
}));

// CORS — must include the exact browser origin (scheme + host, no trailing slash)
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(
          `[CORS] Blocked origin: ${origin}. Allowed: ${getCorsAllowedOrigins().join(', ')}` +
            (process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true' ? ' + *.vercel.app' : ' (set FRONTEND_URLS or CORS_ALLOW_VERCEL_PREVIEWS=true)')
        );
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Liveness (same payload as GET /health) — under apiVersion so SPA + same-origin proxies need only /api/*
const sendLivenessHealth = (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'JetMed API is running',
    timestamp: new Date().toISOString(),
    version: config.app.apiVersion,
    environment: config.app.env,
    deployment: {
      trustProxy: app.get('trust proxy'),
      hint:
        'If trustProxy is false but you deploy on Render, remove TRUST_PROXY=false from env or redeploy latest main.',
    },
  });
};
app.get(`${apiVersion}/health`, sendLivenessHealth);

// Rate limiting (skip X-Forwarded-For strict check — we set trust proxy; keeps Render from 500 if detection lags)
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  skip: (req) => req.originalUrl.includes('/payments/webhook'),
});
app.use('/api', limiter);

// Stripe webhooks require raw body — must run before express.json()
app.post(`${apiVersion}/payments/webhook`, express.raw({ type: 'application/json' }), stripeWebhookHandler);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Compression
app.use(compression());

// Request logging
if (config.app.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ==================== API ROUTES ====================

app.use(`${apiVersion}/auth`, authRoutes);
app.use(`${apiVersion}/users`, userRoutes);
app.use(`${apiVersion}/medicines`, medicineRoutes);
app.use(`${apiVersion}/orders`, orderRoutes);
app.use(`${apiVersion}/prescriptions`, prescriptionRoutes);
app.use(`${apiVersion}/payments`, paymentRoutes);
app.use(`${apiVersion}/pharmacist`, pharmacistRoutes);
app.use(`${apiVersion}/delivery`, deliveryRoutes);
app.use(`${apiVersion}/warehouse`, warehouseRoutes);
app.use(`${apiVersion}/admin`, adminRoutes);
app.use(`${apiVersion}/search`, searchRoutes);
app.use(`${apiVersion}/communication`, communicationRoutes);
app.use(`${apiVersion}/sms`, smsRoutes);

// Root — browsers often open `/`; API lives under `/api/v1` and docs on `/api-docs`
// HEAD / — some platforms (e.g. Render) probe with HEAD; only GET was 404 before
app.head('/', (_req: Request, res: Response) => {
  res.status(200).end();
});
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'JetMed API',
    health: '/health',
    apiHealth: `${apiVersion}/health`,
    readiness: '/health/ready',
    apiInfo: '/api',
    docs: '/api-docs',
    apiBase: apiVersion,
  });
});

// Health check endpoint (not behind /api rate limit — use this to verify deployed code)
app.get('/health', sendLivenessHealth);

app.get('/health/ready', async (_req: Request, res: Response) => {
  const mongoOk = mongoose.connection.readyState === 1;

  const redisSkipped = !config.redis.host;
  const redisPingOk = await (async () => {
    try {
      const redis = getRedisClient();
      if (!redis?.isOpen) return false;
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  })();

  const dependencies = {
    mongodb: mongoOk ? 'up' : 'down',
    redis: redisSkipped ? 'skipped' : redisPingOk ? 'up' : 'down',
  };

  const allHealthy = mongoOk && (redisSkipped || redisPingOk);
  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    status: allHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    dependencies,
    thirdParty: checkServicesHealth(),
  });
});

// API discovery — `/api` and versioned root (`/api/v1`) so probes to `/api/v1/` don't 404
const sendApiDiscovery = (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to JetMed API',
    version: config.app.apiVersion,
    documentation: `${config.app.url}/api-docs`,
    endpoints: {
      auth: `${apiVersion}/auth`,
      users: `${apiVersion}/users`,
      medicines: `${apiVersion}/medicines`,
      orders: `${apiVersion}/orders`,
      prescriptions: `${apiVersion}/prescriptions`,
      payments: `${apiVersion}/payments`,
      pharmacist: `${apiVersion}/pharmacist`,
      delivery: `${apiVersion}/delivery`,
      warehouse: `${apiVersion}/warehouse`,
      admin: `${apiVersion}/admin`,
      search: `${apiVersion}/search`,
      communication: `${apiVersion}/communication`,
      sms: `${apiVersion}/sms`,
    },
  });
};
app.get('/api', sendApiDiscovery);
app.get(apiVersion, sendApiDiscovery);

// Setup Swagger documentation
setupSwagger(app);

// ==================== ERROR HANDLING ====================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ==================== SERVER STARTUP ====================

const startServer = async () => {
  try {
    // Connect to databases (SendGrid/Firebase log at import time — warnings only, non-fatal)
    console.log('🔌 Connecting to databases...');
    
    await connectMongoDB();
    await connectRedis();

    // Start HTTP server (0.0.0.0 so Railway/Docker health checks can reach the port)
    httpServer.listen(config.app.port, config.app.listenHost, () => {
      console.log(`🌐 Listening on http://${config.app.listenHost}:${config.app.port} (PORT env)`);
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 JetMed API Server Started Successfully!                 ║
║                                                              ║
║   📍 URL: ${config.app.url.padEnd(44)}║
║   📚 API Docs: ${(config.app.url + '/api-docs').padEnd(39)}║
║   🌍 Environment: ${config.app.env.padEnd(36)}║
║   📦 API Version: ${config.app.apiVersion.padEnd(36)}║
║                                                              ║
║   "Medicine at the speed of need" 💊                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

export { app, io };
























