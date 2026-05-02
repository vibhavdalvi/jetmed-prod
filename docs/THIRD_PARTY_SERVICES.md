# Third-Party Services Setup Guide

This guide explains how to configure all external services for JetMed.

## Quick Reference: All Environment Variables

```env
# App
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# Database
POSTGRES_URL=postgresql://user:pass@localhost:5432/jetmed
MONGODB_URL=mongodb://localhost:27017/jetmed
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200

# Auth
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+14155238886

# SendGrid
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@jetmed.com

# Agora
AGORA_APP_ID=xxxxx
AGORA_APP_CERTIFICATE=xxxxx

# Google Maps
GOOGLE_MAPS_API_KEY=AIzaxxxxx

# Firebase
FIREBASE_PROJECT_ID=jetmed-xxxxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@jetmed.iam.gserviceaccount.com

# Sentry
SENTRY_DSN=https://xxxxx@o123456.ingest.sentry.io/123456
```

---

## 1. Stripe (Payments)

### Setup Steps
1. Create account at [stripe.com](https://stripe.com)
2. Get API keys from Developers → API Keys
3. Configure webhooks at Developers → Webhooks
   - Endpoint: `https://yourdomain.com/api/v1/payments/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

### Implementation
Create `/backend/src/services/stripe.ts`:
```typescript
import Stripe from 'stripe';
import config from '../config';

const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' });

export const createPaymentIntent = async (amount: number, customerId?: string) => {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    customer: customerId,
    automatic_payment_methods: { enabled: true },
  });
};

export const processRefund = async (chargeId: string, amount?: number) => {
  return stripe.refunds.create({
    charge: chargeId,
    amount: amount ? Math.round(amount * 100) : undefined,
  });
};
```

---

## 2. Twilio (SMS & WhatsApp)

### Setup Steps
1. Sign up at [twilio.com](https://twilio.com)
2. Purchase a phone number for SMS
3. Enable WhatsApp in Messaging → Try it out → WhatsApp

### Implementation
Create `/backend/src/services/twilio.ts`:
```typescript
import Twilio from 'twilio';
import config from '../config';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

export const sendSMS = async (to: string, message: string) => {
  return client.messages.create({
    body: message,
    from: config.twilio.phoneNumber,
    to,
  });
};

export const sendWhatsApp = async (to: string, message: string) => {
  return client.messages.create({
    body: message,
    from: `whatsapp:${config.twilio.whatsappNumber}`,
    to: `whatsapp:${to}`,
  });
};
```

---

## 3. SendGrid (Email)

### Setup Steps
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create API key in Settings → API Keys
3. Authenticate domain for production

### Implementation
Create `/backend/src/services/email.ts`:
```typescript
import sgMail from '@sendgrid/mail';
import config from '../config';

sgMail.setApiKey(config.sendgrid.apiKey);

export const sendEmail = async (to: string, subject: string, html: string) => {
  return sgMail.send({
    to,
    from: { email: config.sendgrid.fromEmail, name: 'JetMed' },
    subject,
    html,
  });
};
```

---

## 4. Agora (Video/Voice Calls)

### Setup Steps
1. Sign up at [agora.io](https://agora.io)
2. Create project with "Secured mode: APP ID + Token"
3. Copy App ID and App Certificate

### Implementation
Create `/backend/src/services/agora.ts`:
```typescript
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import config from '../config';

export const generateRtcToken = (channelName: string, uid: number) => {
  const expireTime = Math.floor(Date.now() / 1000) + 3600;
  return RtcTokenBuilder.buildTokenWithUid(
    config.agora.appId,
    config.agora.appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireTime
  );
};
```

---

## 5. Google Maps (Location)

### Setup Steps
1. Create project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable: Maps JavaScript API, Geocoding API, Directions API, Places API
3. Create API key and restrict to your domains

### Implementation
Create `/backend/src/services/maps.ts`:
```typescript
import { Client } from '@googlemaps/google-maps-services-js';
import config from '../config';

const client = new Client({});

export const geocodeAddress = async (address: string) => {
  const response = await client.geocode({
    params: { address, key: config.googleMaps.apiKey },
  });
  if (response.data.results.length > 0) {
    const { lat, lng } = response.data.results[0].geometry.location;
    return { latitude: lat, longitude: lng };
  }
  throw new Error('Address not found');
};
```

---

## 6. Firebase (Push Notifications)

### Setup Steps
1. Create project at [Firebase Console](https://console.firebase.google.com)
2. Enable Cloud Messaging
3. Download service account JSON

### Implementation
Create `/backend/src/services/firebase.ts`:
```typescript
import admin from 'firebase-admin';
import config from '../config';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: config.firebase.projectId,
    privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
    clientEmail: config.firebase.clientEmail,
  }),
});

export const sendPushNotification = async (token: string, title: string, body: string) => {
  return admin.messaging().send({
    token,
    notification: { title, body },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  });
};
```

---

## 7. Sentry (Error Tracking)

### Setup Steps
1. Sign up at [sentry.io](https://sentry.io)
2. Create Node.js project for backend, React for frontend
3. Get DSN from Project Settings

### Implementation
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: config.sentry.dsn,
  environment: config.app.env,
  tracesSampleRate: 0.1,
});
```

---

## Production Checklist

- [ ] All API keys are production keys (not test/sandbox)
- [ ] Webhook URLs point to production domain
- [ ] Rate limits configured appropriately
- [ ] Error tracking enabled (Sentry)
- [ ] SSL/TLS enabled for all endpoints
- [ ] API keys restricted by domain/IP
- [ ] Logging and monitoring configured
- [ ] Backup payment methods available
- [ ] Email templates tested and approved
- [ ] SMS/WhatsApp templates approved by provider
