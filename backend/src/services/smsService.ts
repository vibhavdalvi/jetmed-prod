import twilio from 'twilio';

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const hasValidTwilioConfig =
  !!accountSid &&
  !!authToken &&
  accountSid.startsWith('AC');

// Initialize Twilio client (null if not configured)
const client = hasValidTwilioConfig ? twilio(accountSid, authToken) : null;

// In-memory OTP store (use Redis in production)
const otpStore = new Map<string, { otp: string; expiresAt: Date }>();

/**
 * Format phone number to E.164 format
 */
const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  return phone.startsWith('+') ? phone : `+${cleaned}`;
};

/**
 * Send SMS message
 */
export const sendSMS = async (to: string, message: string): Promise<{ success: boolean; error?: string }> => {
  const formattedPhone = formatPhone(to);

  // If Twilio not configured, log message (dev mode)
  if (!client || !twilioPhone) {
    console.log('📱 [SMS - DEV MODE]');
    console.log(`   To: ${formattedPhone}`);
    console.log(`   Message: ${message}`);
    return { success: true };
  }

  try {
    await client.messages.create({
      body: message,
      from: twilioPhone,
      to: formattedPhone,
    });
    console.log(`✅ SMS sent to ${formattedPhone}`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ SMS failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Generate 6-digit OTP
 */
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP for phone verification
 */
export const sendOTP = async (phone: string): Promise<{ success: boolean; message: string }> => {
  const formattedPhone = formatPhone(phone);

  // Use Twilio Verify if available
  if (client && verifyServiceSid) {
    try {
      await client.verify.v2
        .services(verifyServiceSid)
        .verifications.create({
          to: formattedPhone,
          channel: 'sms',
        });
      return { success: true, message: 'Verification code sent' };
    } catch (error: any) {
      console.error('Twilio Verify error:', error.message);
      // Fall through to manual OTP
    }
  }

  // Manual OTP fallback
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  otpStore.set(formattedPhone, { otp, expiresAt });

  const message = `Your JetMed verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

  const result = await sendSMS(formattedPhone, message);

  if (result.success) {
    // Log OTP in dev mode for testing
    if (!client) {
      console.log(`🔐 [DEV] OTP for ${formattedPhone}: ${otp}`);
    }
    return { success: true, message: 'Verification code sent' };
  }

  return { success: false, message: result.error || 'Failed to send verification code' };
};

/**
 * Verify OTP
 */
export const verifyOTP = async (phone: string, code: string): Promise<{ success: boolean; message: string }> => {
  const formattedPhone = formatPhone(phone);

  // Use Twilio Verify if available
  if (client && verifyServiceSid) {
    try {
      const verification = await client.verify.v2
        .services(verifyServiceSid)
        .verificationChecks.create({
          to: formattedPhone,
          code,
        });

      if (verification.status === 'approved') {
        return { success: true, message: 'Phone verified successfully' };
      }
      return { success: false, message: 'Invalid verification code' };
    } catch (error: any) {
      console.error('Twilio Verify check error:', error.message);
      // Fall through to manual check
    }
  }

  // Manual OTP verification
  const stored = otpStore.get(formattedPhone);

  if (!stored) {
    return { success: false, message: 'No verification code found. Please request a new one.' };
  }

  if (new Date() > stored.expiresAt) {
    otpStore.delete(formattedPhone);
    return { success: false, message: 'Verification code has expired. Please request a new one.' };
  }

  if (stored.otp !== code) {
    return { success: false, message: 'Invalid verification code' };
  }

  // Success - remove OTP
  otpStore.delete(formattedPhone);
  return { success: true, message: 'Phone verified successfully' };
};

// ===========================================
// ORDER NOTIFICATION TEMPLATES
// ===========================================

export const OrderSMSTemplates = {
  orderPlaced: (orderNumber: string, total: string) =>
    `🛒 JetMed Order Confirmed!\n\nOrder #${orderNumber}\nTotal: $${total}\n\nWe're reviewing your order and will notify you once approved.`,

  orderApproved: (orderNumber: string) =>
    `✅ Order Approved!\n\nYour order #${orderNumber} has been approved by our pharmacist and is being prepared for delivery.`,

  orderRejected: (orderNumber: string, reason: string) =>
    `❌ Order Update\n\nYour order #${orderNumber} requires attention.\nReason: ${reason}\n\nPlease contact support or update your prescription.`,

  outForDelivery: (orderNumber: string, eta: string, driverName: string) =>
    `🚚 Out for Delivery!\n\nOrder #${orderNumber} is on its way!\n\nDriver: ${driverName}\nETA: ${eta}\n\nYou'll receive a delivery OTP shortly.`,

  deliveryOTP: (orderNumber: string, otp: string) =>
    `🔐 Delivery OTP\n\nYour OTP for order #${orderNumber} is: ${otp}\n\nShare this code with the delivery partner to receive your order.`,

  delivered: (orderNumber: string) =>
    `🎉 Delivered!\n\nYour order #${orderNumber} has been delivered successfully.\n\nThank you for choosing JetMed! Stay healthy! 💊`,

  prescriptionExpiring: (medicineName: string, daysLeft: number) =>
    `💊 Prescription Reminder\n\nYour prescription for ${medicineName} expires in ${daysLeft} days.\n\nReorder now on JetMed for fast delivery!`,

  refillReminder: (medicineName: string) =>
    `⏰ Refill Time!\n\nIt's time to refill your ${medicineName}.\n\nOrder now on JetMed and get it delivered in under an hour!`,
};

/**
 * Send order status notification
 */
export const sendOrderNotification = async (
  phone: string,
  template: keyof typeof OrderSMSTemplates,
  ...args: string[]
): Promise<{ success: boolean }> => {
  const templateFn = OrderSMSTemplates[template];
  if (!templateFn) {
    console.error(`Unknown SMS template: ${template}`);
    return { success: false };
  }

  const message = (templateFn as (...args: string[]) => string)(...args);
  return sendSMS(phone, message);
};

/**
 * Generate and send delivery OTP
 */
export const sendDeliveryOTP = async (phone: string, orderNumber: string): Promise<{ otp: string; success: boolean }> => {
  const otp = generateOTP();

  const result = await sendOrderNotification(phone, 'deliveryOTP', orderNumber, otp);

  return { otp, success: result.success };
};

export default {
  sendSMS,
  sendOTP,
  verifyOTP,
  sendOrderNotification,
  sendDeliveryOTP,
  OrderSMSTemplates,
};
