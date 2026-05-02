// @ts-nocheck
/**
 * ============================================
 * JETMED SERVICES INDEX
 * ============================================
 * Central export for all third-party service integrations
 * 
 * Services included:
 * - Stripe: Payment processing, refunds, wallet
 * - Google Maps: Address autocomplete, geocoding, delivery tracking
 * - Agora: VoIP/Video calls for pharmacist-patient communication
 * - Twilio: SMS & WhatsApp notifications
 * - SendGrid: Email notifications
 * - Firebase: Push notifications
 * - Socket.io: Real-time updates
 */

// Payment Services
export * as stripeService from './stripe.js';
export { default as stripe } from './stripe.js';

// Location & Maps
export * as mapsService from './maps.js';
export { default as maps } from './maps.js';

// Communication (VoIP/Video)
export * as agoraService from './agora.js';
export { default as agora } from './agora.js';

// SMS & WhatsApp
export * as twilioService from './twilio.js';
export { default as twilio } from './twilio.js';

// Email
export * as emailService from './email.js';
export { default as email } from './email.js';

// Push Notifications
export * as pushService from './push.js';
export { default as push } from './push.js';

// Real-time Socket
export * as socketService from './socket.js';

// ============================================
// SERVICE HEALTH CHECK
// ============================================

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'not_configured';
  message?: string;
}

/**
 * Check health of all services
 * Useful for debugging and monitoring
 */
export const checkServicesHealth = (): ServiceHealth[] => {
  const services: ServiceHealth[] = [];

  // Stripe
  services.push({
    service: 'Stripe',
    status: process.env.STRIPE_SECRET_KEY ? 'healthy' : 'not_configured',
    message: process.env.STRIPE_SECRET_KEY ? 'API key configured' : 'Set STRIPE_SECRET_KEY',
  });

  // Google Maps
  services.push({
    service: 'Google Maps',
    status: process.env.GOOGLE_MAPS_API_KEY ? 'healthy' : 'not_configured',
    message: process.env.GOOGLE_MAPS_API_KEY ? 'API key configured' : 'Set GOOGLE_MAPS_API_KEY',
  });

  // Agora
  services.push({
    service: 'Agora',
    status: process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE ? 'healthy' : 'not_configured',
    message: process.env.AGORA_APP_ID ? 'App ID configured' : 'Set AGORA_APP_ID and AGORA_APP_CERTIFICATE',
  });

  // Twilio
  services.push({
    service: 'Twilio',
    status: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? 'healthy' : 'not_configured',
    message: process.env.TWILIO_ACCOUNT_SID ? 'Credentials configured' : 'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN',
  });

  // SendGrid
  services.push({
    service: 'SendGrid',
    status: process.env.SENDGRID_API_KEY?.trim().startsWith('SG.')
      ? 'healthy'
      : 'not_configured',
    message: process.env.SENDGRID_API_KEY?.trim().startsWith('SG.')
      ? 'API key configured'
      : 'Set SENDGRID_API_KEY (must start with SG.)',
  });

  // Firebase
  services.push({
    service: 'Firebase',
    status: process.env.FIREBASE_PROJECT_ID ? 'healthy' : 'not_configured',
    message: process.env.FIREBASE_PROJECT_ID ? 'Project configured' : 'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY',
  });

  return services;
};

/**
 * Log service health status to console
 */
export const logServicesHealth = (): void => {
  console.log('\n============================================');
  console.log('JETMED SERVICES HEALTH CHECK');
  console.log('============================================');

  const health = checkServicesHealth();

  health.forEach(({ service, status, message }) => {
    const statusIcon = status === 'healthy' ? '✅' : status === 'not_configured' ? '⚙️' : '❌';
    console.log(`${statusIcon} ${service}: ${status} - ${message}`);
  });

  console.log('============================================\n');
};
