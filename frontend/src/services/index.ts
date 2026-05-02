// ═══════════════════════════════════════════════════════════════════════════════
// JetMed - Frontend Services Index
// ═══════════════════════════════════════════════════════════════════════════════

// Core API
export { default as api } from './api';

// Payment Services
export * from './stripe';
export { default as stripeService } from './stripe';

// Maps & Location Services
export * from './maps';
export { default as mapsService } from './maps';

// Voice/Video Call Services
export * from './agora';
export { default as agoraService } from './agora';

// Push Notification Services
export * from './push';
export { default as pushService } from './push';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

import { initializePushNotifications } from './push';

/**
 * Initialize all services on app startup
 */
export const initializeServices = async (): Promise<void> => {
  console.log('[Services] Initializing...');
  
  // Initialize push notifications
  try {
    await initializePushNotifications();
    console.log('[Services] Push notifications initialized');
  } catch (error) {
    console.warn('[Services] Push notifications initialization failed:', error);
  }
  
  console.log('[Services] All services initialized');
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

import { isFirebaseConfigured } from './push';
import { isAgoraConfigured } from './agora';

interface ServiceStatus {
  name: string;
  configured: boolean;
  status: 'ready' | 'unconfigured' | 'error';
}

/**
 * Check status of all services
 */
export const getServicesStatus = (): ServiceStatus[] => {
  return [
    {
      name: 'Stripe',
      configured: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
      status: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? 'ready' : 'unconfigured',
    },
    {
      name: 'Google Maps',
      configured: !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      status: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'ready' : 'unconfigured',
    },
    {
      name: 'Agora',
      configured: isAgoraConfigured(),
      status: isAgoraConfigured() ? 'ready' : 'unconfigured',
    },
    {
      name: 'Firebase',
      configured: isFirebaseConfigured(),
      status: isFirebaseConfigured() ? 'ready' : 'unconfigured',
    },
  ];
};

/**
 * Log services status to console
 */
export const logServicesStatus = (): void => {
  const statuses = getServicesStatus();
  
  console.group('[Services] Status');
  statuses.forEach((service) => {
    const icon = service.status === 'ready' ? '✅' : '⚠️';
    console.log(`${icon} ${service.name}: ${service.status}`);
  });
  console.groupEnd();
};
