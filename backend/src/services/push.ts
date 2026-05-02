/**
 * ============================================
 * FIREBASE PUSH NOTIFICATION SERVICE
 * ============================================
 * Complete Firebase Cloud Messaging integration for:
 * - Push notifications to mobile/web
 * - Order status updates
 * - Pharmacist alerts
 * - Delivery notifications
 * - Topic-based messaging
 * 
 * Based on 38 Questions: Q13 - Notifications
 * - In-app notifications
 * - Push notifications
 * - Real-time alerts
 */

import admin from 'firebase-admin';
import {
  looksLikeFirebasePem,
  normalizeFirebasePrivateKey,
} from '../utils/firebasePrivateKey.js';

let firebaseReady = false;

// Initialize Firebase Admin SDK only when service account env looks valid (avoids invalid PEM on Railway)
const initializeFirebase = () => {
  if (admin.apps.length) {
    return admin;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = normalizeFirebasePrivateKey(rawKey);

  if (!projectId || !clientEmail || !rawKey?.trim()) {
    console.warn(
      '⚠️ Firebase push disabled: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    );
    return admin;
  }

  if (!looksLikeFirebasePem(privateKey)) {
    console.warn(
      '⚠️ Firebase push disabled: FIREBASE_PRIVATE_KEY must be a PEM private key. Use JSON \\n escapes on one line (Railway) or a quoted multiline block in .env.'
    );
    return admin;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    firebaseReady = true;
    console.log('✅ Firebase Admin SDK initialized');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️ Firebase push disabled: invalid FIREBASE_PRIVATE_KEY (${msg}). Fix PEM formatting (see normalizeFirebasePrivateKey / deploy docs).`
    );
  }
  return admin;
};

initializeFirebase();

export const isFirebasePushReady = () => firebaseReady;

// ============================================
// TYPES
// ============================================

export interface PushNotificationParams {
  token: string | string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  priority?: 'high' | 'normal';
  clickAction?: string;
}

export interface TopicMessageParams {
  topic: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationResult {
  success: boolean;
  successCount?: number;
  failureCount?: number;
  messageId?: string;
  errors?: Array<{
    token: string;
    error: string;
  }>;
}

// Notification categories
export type NotificationCategory =
  | 'order_placed'
  | 'order_approved'
  | 'order_rejected'
  | 'order_packed'
  | 'out_for_delivery'
  | 'order_delivered'
  | 'prescription_review'
  | 'pharmacist_call'
  | 'delivery_assigned'
  | 'low_stock'
  | 'promo';

// ============================================
// SINGLE NOTIFICATION
// ============================================

/**
 * Send push notification to single device
 */
export const sendPushNotification = async (
  params: PushNotificationParams
): Promise<NotificationResult> => {
  const { token, title, body, data, imageUrl, sound, badge, priority = 'high', clickAction } = params;

  if (Array.isArray(token)) {
    return sendMultiplePushNotifications({ ...params, token });
  }

  if (!firebaseReady) {
    return {
      success: false,
      errors: [{ token: token as string, error: 'Firebase push not configured' }],
    };
  }

  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title,
        body,
        imageUrl,
      },
      data: data || {},
      android: {
        priority: priority === 'high' ? 'high' : 'normal',
        notification: {
          sound: sound || 'default',
          clickAction,
          channelId: 'jetmed_notifications',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: sound || 'default',
            badge,
            category: clickAction,
          },
        },
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          actions: clickAction ? [{
            action: clickAction,
            title: 'View',
          }] : undefined,
        },
      },
    };

    const response = await admin.messaging().send(message);

    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error('Push notification error:', error);
    return {
      success: false,
      errors: [{
        token,
        error: error.message,
      }],
    };
  }
};

// ============================================
// MULTIPLE NOTIFICATIONS
// ============================================

/**
 * Send push notifications to multiple devices
 */
export const sendMultiplePushNotifications = async (
  params: PushNotificationParams
): Promise<NotificationResult> => {
  const { token, title, body, data, imageUrl, priority = 'high' } = params;
  const tokens = Array.isArray(token) ? token : [token];

  if (tokens.length === 0) {
    return { success: false, failureCount: 0, successCount: 0 };
  }

  if (!firebaseReady) {
    return {
      success: false,
      failureCount: tokens.length,
      successCount: 0,
      errors: tokens.map((t) => ({ token: t, error: 'Firebase push not configured' })),
    };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
        imageUrl,
      },
      data: data || {},
      android: {
        priority: priority === 'high' ? 'high' : 'normal',
        notification: {
          sound: 'default',
          channelId: 'jetmed_notifications',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const errors: Array<{ token: string; error: string }> = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        errors.push({
          token: tokens[idx],
          error: resp.error.message,
        });
      }
    });

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error('Multicast notification error:', error);
    return {
      success: false,
      errors: [{
        token: tokens[0],
        error: error.message,
      }],
    };
  }
};

// ============================================
// TOPIC MESSAGING
// ============================================

/**
 * Send notification to topic subscribers
 * Topics: pharmacists, delivery_partners, admins, warehouse_staff
 */
export const sendTopicNotification = async (
  params: TopicMessageParams
): Promise<NotificationResult> => {
  const { topic, title, body, data } = params;

  if (!firebaseReady) {
    return {
      success: false,
      errors: [{ token: topic, error: 'Firebase push not configured' }],
    };
  }

  try {
    const message: admin.messaging.Message = {
      topic,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'jetmed_notifications',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    const response = await admin.messaging().send(message);

    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error('Topic notification error:', error);
    return {
      success: false,
      errors: [{
        token: topic,
        error: error.message,
      }],
    };
  }
};

/**
 * Subscribe device to topic
 */
export const subscribeToTopic = async (
  tokens: string | string[],
  topic: string
): Promise<boolean> => {
  const tokenArray = Array.isArray(tokens) ? tokens : [tokens];

  if (!firebaseReady) {
    return false;
  }

  try {
    const response = await admin.messaging().subscribeToTopic(tokenArray, topic);
    console.log(`Subscribed ${response.successCount} devices to topic: ${topic}`);
    return response.successCount > 0;
  } catch (error) {
    console.error('Subscribe to topic error:', error);
    return false;
  }
};

/**
 * Unsubscribe device from topic
 */
export const unsubscribeFromTopic = async (
  tokens: string | string[],
  topic: string
): Promise<boolean> => {
  const tokenArray = Array.isArray(tokens) ? tokens : [tokens];

  if (!firebaseReady) {
    return false;
  }

  try {
    const response = await admin.messaging().unsubscribeFromTopic(tokenArray, topic);
    console.log(`Unsubscribed ${response.successCount} devices from topic: ${topic}`);
    return response.successCount > 0;
  } catch (error) {
    console.error('Unsubscribe from topic error:', error);
    return false;
  }
};

// ============================================
// ORDER NOTIFICATIONS
// ============================================

/**
 * Send order status notification to customer
 */
export const sendOrderStatusNotification = async (
  deviceTokens: string[],
  orderId: string,
  status: NotificationCategory,
  additionalData?: Record<string, string>
): Promise<NotificationResult> => {
  const notifications: Record<NotificationCategory, { title: string; body: string }> = {
    order_placed: {
      title: '✅ Order Placed!',
      body: `Your order #${orderId} has been placed successfully. We're reviewing your prescription.`,
    },
    order_approved: {
      title: '✅ Prescription Approved!',
      body: `Great news! Your prescription for order #${orderId} has been approved. Packing in progress.`,
    },
    order_rejected: {
      title: '❌ Prescription Issue',
      body: `We need to discuss your prescription for order #${orderId}. Please check the app for details.`,
    },
    order_packed: {
      title: '📦 Order Packed!',
      body: `Your order #${orderId} is packed and ready for delivery. A driver will be assigned soon.`,
    },
    out_for_delivery: {
      title: '🚚 Out for Delivery!',
      body: `Your order #${orderId} is on its way! Track the delivery in real-time.`,
    },
    order_delivered: {
      title: '🎉 Order Delivered!',
      body: `Your order #${orderId} has been delivered. Thank you for choosing JetMed!`,
    },
    prescription_review: {
      title: '📋 New Prescription',
      body: `A new prescription is awaiting review for order #${orderId}.`,
    },
    pharmacist_call: {
      title: '📞 Incoming Call',
      body: 'A pharmacist wants to discuss your prescription.',
    },
    delivery_assigned: {
      title: '🚗 New Delivery',
      body: `New delivery order #${orderId} assigned to you.`,
    },
    low_stock: {
      title: '⚠️ Low Stock Alert',
      body: 'Some items are running low in inventory.',
    },
    promo: {
      title: '🎁 Special Offer!',
      body: 'Check out our latest deals and discounts.',
    },
  };

  const notification = notifications[status];

  return sendPushNotification({
    token: deviceTokens,
    title: notification.title,
    body: notification.body,
    data: {
      type: status,
      orderId,
      clickAction: `VIEW_ORDER_${orderId}`,
      ...additionalData,
    },
    clickAction: `VIEW_ORDER_${orderId}`,
  });
};

// ============================================
// PHARMACIST NOTIFICATIONS
// ============================================

/**
 * Alert pharmacist of new prescription to review
 */
export const alertPharmacistNewPrescription = async (
  deviceTokens: string[],
  orderId: string,
  urgency: 'standard' | 'express' | 'emergency'
): Promise<NotificationResult> => {
  const urgencyEmoji = urgency === 'emergency' ? '🚨' : urgency === 'express' ? '⚡' : '📋';
  const title = `${urgencyEmoji} New Prescription to Review`;
  const body = urgency === 'emergency'
    ? `URGENT: Emergency order #${orderId} needs immediate review!`
    : `Order #${orderId} (${urgency}) is waiting for prescription review.`;

  return sendPushNotification({
    token: deviceTokens,
    title,
    body,
    priority: urgency === 'emergency' ? 'high' : 'normal',
    sound: urgency === 'emergency' ? 'alert.wav' : 'default',
    data: {
      type: 'prescription_review',
      orderId,
      urgency,
      clickAction: 'REVIEW_PRESCRIPTION',
    },
  });
};

// ============================================
// DELIVERY PARTNER NOTIFICATIONS
// ============================================

/**
 * Notify delivery partner of new order
 */
export const notifyDeliveryPartnerNewOrder = async (
  deviceTokens: string[],
  orderId: string,
  pickupAddress: string,
  deliveryAddress: string,
  estimatedEarnings: number
): Promise<NotificationResult> => {
  return sendPushNotification({
    token: deviceTokens,
    title: '🚗 New Delivery Available!',
    body: `Order #${orderId} - Earn $${estimatedEarnings.toFixed(2)}. Accept within 2 minutes.`,
    data: {
      type: 'delivery_assigned',
      orderId,
      pickupAddress,
      deliveryAddress,
      earnings: estimatedEarnings.toString(),
      clickAction: 'ACCEPT_DELIVERY',
    },
    priority: 'high',
  });
};

// ============================================
// WAREHOUSE NOTIFICATIONS
// ============================================

/**
 * Notify warehouse of new order to pack
 */
export const notifyWarehouseNewOrder = async (
  deviceTokens: string[],
  orderId: string,
  itemCount: number
): Promise<NotificationResult> => {
  return sendPushNotification({
    token: deviceTokens,
    title: '📦 New Order to Pack',
    body: `Order #${orderId} - ${itemCount} items ready to be packed.`,
    data: {
      type: 'pack_order',
      orderId,
      itemCount: itemCount.toString(),
      clickAction: 'PACK_ORDER',
    },
  });
};

/**
 * Low stock alert to warehouse
 */
export const sendLowStockAlert = async (
  deviceTokens: string[],
  medicineName: string,
  currentStock: number,
  reorderLevel: number
): Promise<NotificationResult> => {
  return sendPushNotification({
    token: deviceTokens,
    title: '⚠️ Low Stock Alert',
    body: `${medicineName} is low (${currentStock}/${reorderLevel}). Please restock soon.`,
    data: {
      type: 'low_stock',
      medicineName,
      currentStock: currentStock.toString(),
      reorderLevel: reorderLevel.toString(),
      clickAction: 'VIEW_INVENTORY',
    },
  });
};

// ============================================
// SILENT NOTIFICATIONS
// ============================================

/**
 * Send silent notification for data sync
 */
export const sendSilentNotification = async (
  token: string,
  data: Record<string, string>
): Promise<NotificationResult> => {
  if (!firebaseReady) {
    return {
      success: false,
      errors: [{ token, error: 'Firebase push not configured' }],
    };
  }

  try {
    const message: admin.messaging.Message = {
      token,
      data,
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);

    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    return {
      success: false,
      errors: [{ token, error: error.message }],
    };
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validate FCM token
 */
export const validateToken = async (token: string): Promise<boolean> => {
  if (!firebaseReady) {
    return false;
  }

  try {
    // Try to send a dry run
    await admin.messaging().send({
      token,
      notification: {
        title: 'Test',
        body: 'Test',
      },
    }, true); // Dry run

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Remove invalid tokens from list
 */
export const filterValidTokens = async (tokens: string[]): Promise<string[]> => {
  const validTokens: string[] = [];

  for (const token of tokens) {
    if (await validateToken(token)) {
      validTokens.push(token);
    }
  }

  return validTokens;
};

/**
 * Validate Firebase configuration
 */
export const validateConfiguration = (): boolean => firebaseReady;

// ============================================
// EXPORTS
// ============================================

export default {
  // Single notification
  sendPushNotification,

  // Multiple notifications
  sendMultiplePushNotifications,

  // Topics
  sendTopicNotification,
  subscribeToTopic,
  unsubscribeFromTopic,

  // Order notifications
  sendOrderStatusNotification,

  // Staff notifications
  alertPharmacistNewPrescription,
  notifyDeliveryPartnerNewOrder,
  notifyWarehouseNewOrder,
  sendLowStockAlert,

  // Silent
  sendSilentNotification,

  // Utilities
  validateToken,
  filterValidTokens,
  validateConfiguration,
};
