// @ts-nocheck
/**
 * ============================================
 * TWILIO SMS & WHATSAPP SERVICE
 * ============================================
 * Complete Twilio integration for:
 * - SMS notifications
 * - WhatsApp messages
 * - OTP verification
 * - Order status updates
 * - Delivery notifications
 * 
 * Based on 38 Questions: Q13 - Notifications
 * - SMS notifications
 * - WhatsApp notifications
 * - OTP for verification
 */

import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '';
const twilioWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || '';

const hasValidTwilioConfig = !!accountSid && !!authToken && accountSid.startsWith('AC');
const client = hasValidTwilioConfig ? twilio(accountSid, authToken) : null;

const assertTwilioClient = () => {
  if (!client) {
    throw new Error('Twilio is not configured. Set valid TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
  }
  return client;
};

// ============================================
// TYPES
// ============================================

export interface SMSParams {
  to: string;
  body: string;
  mediaUrl?: string[];
}

export interface WhatsAppParams {
  to: string;
  body: string;
  mediaUrl?: string[];
}

export interface OTPParams {
  to: string;
  code: string;
  channel: 'sms' | 'whatsapp';
  expiryMinutes?: number;
}

export interface MessageResult {
  sid: string;
  status: string;
  to: string;
  dateCreated: Date;
}

export interface OrderNotification {
  orderId: string;
  customerPhone: string;
  customerName: string;
  status: string;
  deliveryPartnerName?: string;
  deliveryPartnerPhone?: string;
  estimatedTime?: string;
  otp?: string;
}

// ============================================
// SMS MESSAGING
// ============================================

/**
 * Send SMS message
 */
export const sendSMS = async (params: SMSParams): Promise<MessageResult> => {
  const { to, body, mediaUrl } = params;
  const twilioClient = assertTwilioClient();

  try {
    const message = await twilioClient.messages.create({
      from: twilioPhone,
      to: formatPhoneNumber(to),
      body,
      mediaUrl,
    });

    return {
      sid: message.sid,
      status: message.status,
      to: message.to,
      dateCreated: message.dateCreated,
    };
  } catch (error: any) {
    console.error('SMS send error:', error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

/**
 * Send bulk SMS
 */
export const sendBulkSMS = async (
  recipients: string[],
  body: string
): Promise<MessageResult[]> => {
  const results: MessageResult[] = [];

  for (const to of recipients) {
    try {
      const result = await sendSMS({ to, body });
      results.push(result);
    } catch (error) {
      console.error(`Failed to send SMS to ${to}:`, error);
    }
  }

  return results;
};

// ============================================
// WHATSAPP MESSAGING
// ============================================

/**
 * Send WhatsApp message
 * Per Q13: WhatsApp notifications for order updates
 */
export const sendWhatsApp = async (params: WhatsAppParams): Promise<MessageResult> => {
  const { to, body, mediaUrl } = params;
  const twilioClient = assertTwilioClient();

  try {
    const message = await twilioClient.messages.create({
      from: twilioWhatsApp,
      to: `whatsapp:${formatPhoneNumber(to)}`,
      body,
      mediaUrl,
    });

    return {
      sid: message.sid,
      status: message.status,
      to: message.to,
      dateCreated: message.dateCreated,
    };
  } catch (error: any) {
    console.error('WhatsApp send error:', error);
    throw new Error(`Failed to send WhatsApp: ${error.message}`);
  }
};

/**
 * Send WhatsApp template message
 * Note: Templates must be pre-approved by WhatsApp
 */
export const sendWhatsAppTemplate = async (
  to: string,
  templateSid: string,
  variables: Record<string, string>
): Promise<MessageResult> => {
  const twilioClient = assertTwilioClient();
  try {
    const message = await twilioClient.messages.create({
      from: twilioWhatsApp,
      to: `whatsapp:${formatPhoneNumber(to)}`,
      contentSid: templateSid,
      contentVariables: JSON.stringify(variables),
    });

    return {
      sid: message.sid,
      status: message.status,
      to: message.to,
      dateCreated: message.dateCreated,
    };
  } catch (error: any) {
    console.error('WhatsApp template error:', error);
    throw new Error(`Failed to send WhatsApp template: ${error.message}`);
  }
};

// ============================================
// OTP VERIFICATION
// ============================================

/**
 * Generate OTP code
 */
export const generateOTP = (length: number = 6): string => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

/**
 * Send OTP for verification
 * Per Q8: Phone + OTP authentication
 */
export const sendOTP = async (params: OTPParams): Promise<MessageResult> => {
  const { to, code, channel, expiryMinutes = 10 } = params;

  const body = `Your JetMed verification code is: ${code}. This code expires in ${expiryMinutes} minutes. Do not share this code with anyone.`;

  if (channel === 'whatsapp') {
    return sendWhatsApp({ to, body });
  }

  return sendSMS({ to, body });
};

/**
 * Send delivery OTP to customer
 * Per Q6: OTP verification for delivery
 */
export const sendDeliveryOTP = async (
  phone: string,
  otp: string,
  deliveryPartnerName: string,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<MessageResult> => {
  const body = `Your JetMed delivery OTP is: ${otp}. Share this code with ${deliveryPartnerName} to receive your order.`;

  if (channel === 'whatsapp') {
    return sendWhatsApp({ to: phone, body });
  }

  return sendSMS({ to: phone, body });
};

// ============================================
// ORDER NOTIFICATIONS
// ============================================

/**
 * Send order confirmation
 */
export const sendOrderConfirmation = async (
  notification: OrderNotification,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<MessageResult> => {
  const body = `Hi ${notification.customerName}! Your JetMed order #${notification.orderId} has been placed successfully. We'll notify you once it's reviewed by our pharmacist. Track your order at: jetmed.com/track/${notification.orderId}`;

  if (channel === 'whatsapp') {
    return sendWhatsApp({ to: notification.customerPhone, body });
  }

  return sendSMS({ to: notification.customerPhone, body });
};

/**
 * Send prescription approval notification
 */
export const sendPrescriptionApproved = async (
  notification: OrderNotification,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<MessageResult> => {
  const body = `Great news, ${notification.customerName}! Your prescription for order #${notification.orderId} has been approved. Your medicines are being packed and will be delivered soon.`;

  if (channel === 'whatsapp') {
    return sendWhatsApp({ to: notification.customerPhone, body });
  }

  return sendSMS({ to: notification.customerPhone, body });
};

/**
 * Send prescription rejection notification
 */
export const sendPrescriptionRejected = async (
  notification: OrderNotification,
  reason: string,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<MessageResult> => {
  const body = `Hi ${notification.customerName}, unfortunately your prescription for order #${notification.orderId} could not be verified. Reason: ${reason}. Your payment will be refunded within 3-5 business days. Please contact support for assistance.`;

  if (channel === 'whatsapp') {
    return sendWhatsApp({ to: notification.customerPhone, body });
  }

  return sendSMS({ to: notification.customerPhone, body });
};

/**
 * Send out for delivery notification
 */
export const sendOutForDelivery = async (
  notification: OrderNotification,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<MessageResult> => {
  const body = `Hi ${notification.customerName}! Your order #${notification.orderId} is out for delivery. ${notification.deliveryPartnerName} will arrive in approximately ${notification.estimatedTime}. Delivery OTP: ${notification.otp}`;

  if (channel === 'whatsapp') {
    return sendWhatsApp({ to: notification.customerPhone, body });
  }

  return sendSMS({ to: notification.customerPhone, body });
};

/**
 * Send order delivered notification
 */
export const sendOrderDelivered = async (
  notification: OrderNotification,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<MessageResult> => {
  const body = `Your JetMed order #${notification.orderId} has been delivered! Thank you for choosing JetMed. Rate your experience: jetmed.com/rate/${notification.orderId}`;

  if (channel === 'whatsapp') {
    return sendWhatsApp({ to: notification.customerPhone, body });
  }

  return sendSMS({ to: notification.customerPhone, body });
};

// ============================================
// DELIVERY PARTNER NOTIFICATIONS
// ============================================

/**
 * Notify delivery partner of new order
 */
export const notifyDeliveryPartner = async (
  phone: string,
  orderId: string,
  pickupAddress: string,
  deliveryAddress: string,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<MessageResult> => {
  const body = `New delivery order #${orderId}! Pickup: ${pickupAddress}. Deliver to: ${deliveryAddress}. Accept in app within 2 minutes.`;

  if (channel === 'whatsapp') {
    return sendWhatsApp({ to: phone, body });
  }

  return sendSMS({ to: phone, body });
};

// ============================================
// PHARMACIST NOTIFICATIONS
// ============================================

/**
 * Alert pharmacist of new prescription to review
 */
export const alertPharmacistNewPrescription = async (
  phone: string,
  orderId: string,
  urgency: 'standard' | 'express' | 'emergency',
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<MessageResult> => {
  const urgencyText = urgency === 'emergency' ? '🚨 URGENT: ' : urgency === 'express' ? '⚡ Express: ' : '';
  const body = `${urgencyText}New prescription awaiting review for order #${orderId}. Please review in the JetMed pharmacist portal.`;

  if (channel === 'whatsapp') {
    return sendWhatsApp({ to: phone, body });
  }

  return sendSMS({ to: phone, body });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format phone number to E.164 format
 */
const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Add + if not present and starts with country code
  if (!cleaned.startsWith('+')) {
    // Assume US number if 10 digits
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    }
    // Assume Indian number if 10 digits starting with 6-9
    else if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
      cleaned = '+91' + cleaned;
    }
    // Add + if it seems like a full number
    else if (cleaned.length > 10) {
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
};

/**
 * Validate phone number
 */
export const validatePhoneNumber = async (phone: string): Promise<{
  valid: boolean;
  phoneNumber?: string;
  countryCode?: string;
  carrier?: string;
  type?: string;
}> => {
  try {
    const twilioClient = assertTwilioClient();
    const lookupResult = await twilioClient.lookups.v2
      .phoneNumbers(formatPhoneNumber(phone))
      .fetch({ fields: 'carrier,sms_pumping_risk' });

    return {
      valid: lookupResult.valid,
      phoneNumber: lookupResult.phoneNumber,
      countryCode: lookupResult.countryCode,
      carrier: lookupResult.carrier?.name,
      type: lookupResult.carrier?.type,
    };
  } catch (error) {
    return { valid: false };
  }
};

/**
 * Get message status
 */
export const getMessageStatus = async (messageSid: string): Promise<string> => {
  const twilioClient = assertTwilioClient();
  const message = await twilioClient.messages(messageSid).fetch();
  return message.status;
};

/**
 * Validate Twilio configuration
 */
export const validateConfiguration = (): boolean => {
  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    console.error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    return false;
  }
  if (!twilioPhone) {
    console.error('Twilio phone number not configured. Set TWILIO_PHONE_NUMBER');
    return false;
  }
  return true;
};

// ============================================
// EXPORTS
// ============================================

export default {
  // SMS
  sendSMS,
  sendBulkSMS,

  // WhatsApp
  sendWhatsApp,
  sendWhatsAppTemplate,

  // OTP
  generateOTP,
  sendOTP,
  sendDeliveryOTP,

  // Order notifications
  sendOrderConfirmation,
  sendPrescriptionApproved,
  sendPrescriptionRejected,
  sendOutForDelivery,
  sendOrderDelivered,

  // Staff notifications
  notifyDeliveryPartner,
  alertPharmacistNewPrescription,

  // Utilities
  validatePhoneNumber,
  getMessageStatus,
  validateConfiguration,
};
