// ═══════════════════════════════════════════════════════════════════════════════
// JetMed - Firebase Push Notifications Service (Frontend)
// ═══════════════════════════════════════════════════════════════════════════════

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  Messaging,
  MessagePayload,
} from 'firebase/messaging';
import api from './api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface NotificationData {
  type: string;
  orderId?: string;
  title: string;
  body: string;
  [key: string]: string | undefined;
}

export interface NotificationHandler {
  (payload: MessagePayload): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let currentToken: string | null = null;

/**
 * Check if Firebase is configured
 */
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId
  );
};

/**
 * Initialize Firebase
 */
export const initializeFirebase = (): FirebaseApp | null => {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured');
    return null;
  }
  
  if (!app) {
    const existingApps = getApps();
    app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
  }
  
  return app;
};

/**
 * Get Firebase Messaging instance
 */
export const getMessagingInstance = (): Messaging | null => {
  if (!messaging) {
    const firebaseApp = initializeFirebase();
    if (!firebaseApp) return null;
    
    try {
      messaging = getMessaging(firebaseApp);
    } catch (error) {
      console.error('Failed to initialize Firebase Messaging:', error);
      return null;
    }
  }
  
  return messaging;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION & TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check notification permission status
 */
export const getPermissionStatus = (): NotificationPermission => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Request notification permission
 */
export const requestPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
};

/**
 * Get FCM token for this device
 */
export const getFCMToken = async (): Promise<string | null> => {
  if (currentToken) return currentToken;
  
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) return null;
  
  const permission = getPermissionStatus();
  if (permission !== 'granted') {
    const granted = await requestPermission();
    if (!granted) return null;
  }
  
  try {
    // Get VAPID key from environment or use default
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    
    currentToken = await getToken(messagingInstance, {
      vapidKey,
    });
    
    return currentToken;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
};

/**
 * Register device token with backend
 */
export const registerDeviceToken = async (): Promise<boolean> => {
  const token = await getFCMToken();
  if (!token) return false;
  
  try {
    await api.post('/notifications/register-device', {
      token,
      platform: 'web',
      deviceInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to register device token:', error);
    return false;
  }
};

/**
 * Unregister device token
 */
export const unregisterDeviceToken = async (): Promise<void> => {
  if (!currentToken) return;
  
  try {
    await api.post('/notifications/unregister-device', {
      token: currentToken,
    });
    currentToken = null;
  } catch (error) {
    console.error('Failed to unregister device token:', error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

const messageHandlers: Set<NotificationHandler> = new Set();

/**
 * Subscribe to foreground messages
 */
export const onForegroundMessage = (handler: NotificationHandler): (() => void) => {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) {
    console.warn('Firebase Messaging not initialized');
    return () => {};
  }
  
  messageHandlers.add(handler);
  
  // Set up listener if this is the first handler
  if (messageHandlers.size === 1) {
    onMessage(messagingInstance, (payload) => {
      messageHandlers.forEach((h) => h(payload));
    });
  }
  
  // Return unsubscribe function
  return () => {
    messageHandlers.delete(handler);
  };
};

/**
 * Handle notification click action
 */
export const handleNotificationAction = (data: NotificationData): void => {
  const { type, orderId } = data;
  
  switch (type) {
    case 'order_confirmed':
    case 'order_approved':
    case 'order_out_for_delivery':
    case 'order_delivered':
      if (orderId) {
        window.location.href = `/orders/${orderId}`;
      }
      break;
    
    case 'prescription_rejected':
      if (orderId) {
        window.location.href = `/orders/${orderId}/prescription`;
      }
      break;
    
    case 'incoming_call':
      if (orderId) {
        window.location.href = `/call/${orderId}`;
      }
      break;
    
    case 'new_order':
      window.location.href = '/pharmacist/orders';
      break;
    
    case 'delivery_assigned':
      window.location.href = '/delivery/orders';
      break;
    
    default:
      window.location.href = '/';
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Show a local notification (for foreground messages)
 */
export const showLocalNotification = (
  title: string,
  options?: NotificationOptions
): Notification | null => {
  if (getPermissionStatus() !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }
  
  try {
    const notification = new Notification(title, {
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      ...options,
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
    
    return notification;
  } catch (error) {
    console.error('Failed to show notification:', error);
    return null;
  }
};

/**
 * Show notification from Firebase message payload
 */
export const showNotificationFromPayload = (payload: MessagePayload): void => {
  const { notification, data } = payload;
  
  if (!notification) return;
  
  const notif = showLocalNotification(notification.title || 'JetMed', {
    body: notification.body,
    data,
    tag: (data?.orderId as string) || 'default',
    requireInteraction: data?.type === 'incoming_call',
  });
  
  if (notif && data) {
    notif.onclick = () => {
      handleNotificationAction(data as NotificationData);
      notif.close();
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════════

export interface NotificationPreferences {
  orderUpdates: boolean;
  promotions: boolean;
  prescriptionReminders: boolean;
  deliveryAlerts: boolean;
  sound: boolean;
  vibration: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  orderUpdates: true,
  promotions: false,
  prescriptionReminders: true,
  deliveryAlerts: true,
  sound: true,
  vibration: true,
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = (): NotificationPreferences => {
  const stored = localStorage.getItem('notificationPreferences');
  if (stored) {
    try {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }
  return DEFAULT_PREFERENCES;
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (
  preferences: Partial<NotificationPreferences>
): Promise<void> => {
  const current = getNotificationPreferences();
  const updated = { ...current, ...preferences };
  
  localStorage.setItem('notificationPreferences', JSON.stringify(updated));
  
  // Sync with backend
  try {
    await api.put('/users/notification-preferences', updated);
  } catch (error) {
    console.error('Failed to sync notification preferences:', error);
  }
};

/**
 * Should show notification based on preferences
 */
export const shouldShowNotification = (type: string): boolean => {
  const preferences = getNotificationPreferences();
  
  switch (type) {
    case 'order_confirmed':
    case 'order_approved':
    case 'order_out_for_delivery':
    case 'order_delivered':
    case 'prescription_rejected':
      return preferences.orderUpdates;
    
    case 'promotion':
    case 'discount':
      return preferences.promotions;
    
    case 'prescription_reminder':
    case 'refill_reminder':
      return preferences.prescriptionReminders;
    
    case 'delivery_arriving':
    case 'delivery_delayed':
      return preferences.deliveryAlerts;
    
    default:
      return true;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC SUBSCRIPTIONS (for staff)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to notification topic
 */
export const subscribeToTopic = async (topic: string): Promise<boolean> => {
  const token = await getFCMToken();
  if (!token) return false;
  
  try {
    await api.post('/notifications/subscribe', { token, topic });
    return true;
  } catch (error) {
    console.error('Failed to subscribe to topic:', error);
    return false;
  }
};

/**
 * Unsubscribe from notification topic
 */
export const unsubscribeFromTopic = async (topic: string): Promise<boolean> => {
  const token = await getFCMToken();
  if (!token) return false;
  
  try {
    await api.post('/notifications/unsubscribe', { token, topic });
    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from topic:', error);
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register Firebase messaging service worker
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize push notifications (call on app start)
 */
export const initializePushNotifications = async (): Promise<boolean> => {
  // Check if configured
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured, skipping push notifications');
    return false;
  }
  
  // Register service worker
  await registerServiceWorker();
  
  // Initialize Firebase
  initializeFirebase();
  
  // Check permission status
  const permission = getPermissionStatus();
  
  if (permission === 'granted') {
    // Already have permission, register token
    await registerDeviceToken();
    return true;
  }
  
  if (permission === 'default') {
    // Will ask for permission later (e.g., on user action)
    return true;
  }
  
  // Permission denied
  return false;
};

export default {
  isFirebaseConfigured,
  initializeFirebase,
  getPermissionStatus,
  requestPermission,
  getFCMToken,
  registerDeviceToken,
  unregisterDeviceToken,
  onForegroundMessage,
  handleNotificationAction,
  showLocalNotification,
  showNotificationFromPayload,
  getNotificationPreferences,
  updateNotificationPreferences,
  shouldShowNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
  registerServiceWorker,
  initializePushNotifications,
};
