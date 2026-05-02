import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeFirebasePrivateKey } from '../utils/firebasePrivateKey.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

/** Production: treat localhost-only URIs as unset (no accidental connects inside Railway). */
function resolveMongoUri(): string {
  const env = process.env.NODE_ENV || 'development';
  if (process.env.MONGODB_DISABLED === 'true') {
    return '';
  }

  let uri =
    process.env.MONGODB_URI?.trim() ||
    (env !== 'production' ? 'mongodb://127.0.0.1:27017/jetmed_logs' : '');

  if (!uri || env !== 'production') {
    return uri;
  }

  const localUri =
    /mongodb(\+srv)?:\/\/(?:[^\s@]*@)?127\.0\.0\.1\b/.test(uri) ||
    /mongodb(\+srv)?:\/\/(?:[^\s@]*@)?localhost\b/.test(uri);

  return localUri ? '' : uri;
}

const config = {
  // Application
  app: {
    name: process.env.APP_NAME || 'JetMed',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000', 10),
    /** Required for Docker/Railway so the process accepts external health checks (not just 127.0.0.1) */
    listenHost: process.env.LISTEN_HOST || '0.0.0.0',
    apiVersion: process.env.API_VERSION || 'v1',
    /** APP_URL preferred; Render injects RENDER_EXTERNAL_URL when unset */
    url:
      process.env.APP_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'http://localhost:5000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  // JWT Authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Session
  session: {
    timeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10),
  },

  // PostgreSQL — prefer DATABASE_URL on Railway/Heroku (single reference from Postgres plugin)
  postgres: {
    databaseUrl: (process.env.DATABASE_URL || '').trim(),
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'jetmed',
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    dialect: 'postgres' as const,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },

  // MongoDB (optional — activity audit logs; MONGODB_VERBOSE for logs; MONGODB_DISABLED=true to skip)
  mongodb: {
    uri: resolveMongoUri(),
  },

  // Redis (optional — omit REDIS_HOST in production, or set REDIS_DISABLED=true)
  redis: (() => {
    const env = process.env.NODE_ENV || 'development';
    let host = process.env.REDIS_HOST?.trim() || '';
    if (process.env.REDIS_DISABLED === 'true') {
      host = '';
    } else if (env === 'production') {
      // Container localhost is never a real Redis on Railway — skip connect, no log spam
      if (!host || host === 'localhost' || host === '127.0.0.1') {
        host = '';
      }
    } else if (!host) {
      host = 'localhost';
    }
    return {
      host,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };
  })(),

  // Elasticsearch
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    auth: process.env.ELASTICSEARCH_USERNAME ? {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD || '',
    } : undefined,
  },

  // File Upload
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,image/webp,application/pdf,image/heic').split(','),
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
  },

  // SendGrid
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@jetmed.com',
    fromNames: {
      orders: process.env.SENDGRID_FROM_NAME_ORDERS || 'JetMed Orders',
      support: process.env.SENDGRID_FROM_NAME_SUPPORT || 'JetMed Support',
      notifications: process.env.SENDGRID_FROM_NAME_NOTIFICATIONS || 'JetMed Notifications',
      marketing: process.env.SENDGRID_FROM_NAME_MARKETING || 'JetMed',
    },
  },

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: normalizeFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY) || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
  },

  // Apple Sign In
  apple: {
    clientId: process.env.APPLE_CLIENT_ID || '',
    teamId: process.env.APPLE_TEAM_ID || '',
    keyId: process.env.APPLE_KEY_ID || '',
    privateKey: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  },

  // Google Maps
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  // Agora
  agora: {
    appId: process.env.AGORA_APP_ID || '',
    appCertificate: process.env.AGORA_APP_CERTIFICATE || '',
  },

  // Sentry
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Login Security
  loginSecurity: {
    maxAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutMinutes: parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10),
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-32-character-key-change!',
  },

  // Two Factor Auth
  twoFactor: {
    appName: process.env.TWO_FACTOR_APP_NAME || 'JetMed',
  },

  // Data Retention
  dataRetention: {
    years: parseInt(process.env.DATA_RETENTION_YEARS || '7', 10),
  },

  // Review SLA (in minutes)
  reviewSLA: {
    emergency: 5,
    urgent: 15,
    routine: 30,
  },

  // Delivery Settings (defaults, can be overridden from admin)
  delivery: {
    standard: {
      minHours: 2,
      maxHours: 4,
      fee: 0,
    },
    express: {
      maxMinutes: 60,
      fee: 9.99,
    },
    emergency: {
      maxMinutes: 30,
      fee: 19.99,
    },
    scheduled: {
      fee: 0,
    },
  },

  // Prescription Validity (in days)
  prescriptionValidity: {
    default: 180, // 6 months
    antibiotics: 7,
    controlled: 30,
    chronic: 365,
  },

  // Expiry Settings (in days)
  expiry: {
    alertDays: 90,
    removeFromStoreDays: 30,
  },
};

/**
 * Allowed browser origins for CORS + Socket.IO.
 * Set FRONTEND_URL to your primary site (e.g. https://xxx.vercel.app).
 * Add FRONTEND_URLS=comma,separated,extras for preview deploys or extra domains.
 */
export function getCorsAllowedOrigins(): string[] {
  const primary = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  const extras = (process.env.FRONTEND_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([primary, ...extras])];
}

/** CORS + Socket.IO: allow list, or any https://*.vercel.app when CORS_ALLOW_VERCEL_PREVIEWS=true */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (getCorsAllowedOrigins().includes(origin)) return true;
  if (process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true') {
    try {
      const u = new URL(origin);
      return u.protocol === 'https:' && u.hostname.endsWith('.vercel.app');
    } catch {
      return false;
    }
  }
  return false;
}

export default config;
