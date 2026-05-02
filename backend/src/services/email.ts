/**
 * ============================================
 * SENDGRID EMAIL SERVICE
 * ============================================
 * Complete SendGrid integration for:
 * - Transactional emails
 * - Order confirmations
 * - Prescription notifications
 * - Password reset
 * - Welcome emails
 * - Invoice emails with PDF attachment
 * 
 * Based on 38 Questions: Q13 - Notifications
 * - Email notifications for all order updates
 * - Invoice PDFs
 * - Marketing emails (with opt-in)
 */

import sgMail from '@sendgrid/mail';

// Initialize SendGrid only when key looks valid (avoids "API key does not start with SG." on empty/wrong keys)
const sendgridKey = process.env.SENDGRID_API_KEY?.trim();
const sendgridConfigured = Boolean(sendgridKey?.startsWith('SG.'));

if (sendgridConfigured) {
  sgMail.setApiKey(sendgridKey!);
} else if (sendgridKey) {
  console.warn('⚠️ SENDGRID_API_KEY is set but invalid (must start with SG.); transactional email disabled until fixed.');
}

export const isSendgridConfigured = (): boolean => sendgridConfigured;

// Email configurations
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@jetmed.com';
const FROM_NAME_ORDERS = process.env.SENDGRID_FROM_NAME_ORDERS || 'JetMed Orders';
const FROM_NAME_SUPPORT = process.env.SENDGRID_FROM_NAME_SUPPORT || 'JetMed Support';
const FROM_NAME_NOTIFICATIONS = process.env.SENDGRID_FROM_NAME_NOTIFICATIONS || 'JetMed Notifications';
const FROM_NAME_MARKETING = process.env.SENDGRID_FROM_NAME_MARKETING || 'JetMed';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ============================================
// TYPES
// ============================================

export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  attachments?: Array<{
    content: string; // Base64 encoded
    filename: string;
    type: string;
    disposition?: 'attachment' | 'inline';
  }>;
  categories?: string[];
  sendAt?: number; // Unix timestamp for scheduled send
}

export interface OrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  deliveryAddress: string;
  deliveryType: string;
  estimatedDelivery?: string;
  trackingUrl: string;
}

export interface InvoiceEmailData extends OrderEmailData {
  invoiceNumber: string;
  invoiceDate: string;
  paymentMethod: string;
  paymentStatus: string;
  invoicePdf?: string; // Base64 encoded PDF
}

// ============================================
// EMAIL SENDING
// ============================================

/**
 * Send single email
 */
export const sendEmail = async (params: EmailParams): Promise<boolean> => {
  const { to, subject, html, text, fromName = FROM_NAME_NOTIFICATIONS, attachments, categories, sendAt } = params;

  if (!sendgridConfigured) {
    return false;
  }

  try {
    const msg: any = {
      to,
      from: {
        email: FROM_EMAIL,
        name: fromName,
      },
      subject,
      html,
      text: text || stripHtml(html),
    };

    if (attachments) {
      msg.attachments = attachments;
    }

    if (categories) {
      msg.categories = categories;
    }

    if (sendAt) {
      msg.sendAt = sendAt;
    }

    await sgMail.send(msg);
    return true;
  } catch (error: any) {
    console.error('Email send error:', error.response?.body || error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send bulk emails
 */
export const sendBulkEmail = async (
  messages: EmailParams[]
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  for (const msg of messages) {
    try {
      await sendEmail(msg);
      success++;
    } catch (error) {
      failed++;
      console.error(`Failed to send email to ${msg.to}:`, error);
    }
  }

  return { success, failed };
};

// ============================================
// AUTHENTICATION EMAILS
// ============================================

/**
 * Send welcome email after registration
 */
export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<boolean> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0066FF, #00D4AA); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { background: #fff; padding: 30px; border: 1px solid #eee; }
        .button { display: inline-block; background: #0066FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💊 Welcome to JetMed!</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Thank you for joining JetMed! We're excited to have you as part of our community.</p>
          <p>With JetMed, you can:</p>
          <ul>
            <li>🚀 Get medicines delivered in as fast as 30 minutes</li>
            <li>💬 Consult with licensed pharmacists</li>
            <li>📋 Manage your prescriptions easily</li>
            <li>🔒 Keep your health information secure</li>
          </ul>
          <p>Start shopping for your medicines now:</p>
          <a href="${FRONTEND_URL}/medicines" class="button">Browse Medicines</a>
          <p>If you have any questions, our support team is here to help 24/7.</p>
          <p>Stay healthy,<br>The JetMed Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} JetMed. All rights reserved.</p>
          <p>You're receiving this email because you signed up for JetMed.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to JetMed! 💊',
    html,
    fromName: FROM_NAME_NOTIFICATIONS,
    categories: ['welcome', 'transactional'],
  });
};

/**
 * Send email verification
 */
export const sendEmailVerification = async (
  email: string,
  name: string,
  verificationToken: string
): Promise<boolean> => {
  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066FF; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #eee; }
        .button { display: inline-block; background: #0066FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" class="button">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create a JetMed account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} JetMed. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your JetMed Email',
    html,
    fromName: FROM_NAME_SUPPORT,
    categories: ['verification', 'transactional'],
  });
};

/**
 * Send password reset email
 */
export const sendPasswordReset = async (
  email: string,
  name: string,
  resetToken: string
): Promise<boolean> => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FF6B6B; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #eee; }
        .button { display: inline-block; background: #FF6B6B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { background: #FFF3CD; border: 1px solid #FFEEBA; padding: 15px; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>We received a request to reset your JetMed password. Click the button below to create a new password:</p>
          <a href="${resetUrl}" class="button">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email and ensure your account is secure.
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} JetMed. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Reset Your JetMed Password',
    html,
    fromName: FROM_NAME_SUPPORT,
    categories: ['password-reset', 'transactional'],
  });
};

// ============================================
// ORDER EMAILS
// ============================================

/**
 * Send order confirmation email
 */
export const sendOrderConfirmation = async (data: OrderEmailData): Promise<boolean> => {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #22C55E, #16A34A); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #eee; }
        .order-summary { background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #0066FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #F3F4F6; padding: 10px; text-align: left; }
        .total-row { font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Order Confirmed!</h1>
        </div>
        <div class="content">
          <h2>Thank you, ${data.customerName}!</h2>
          <p>Your order <strong>#${data.orderId}</strong> has been placed successfully.</p>
          
          <div class="order-summary">
            <h3>Order Summary</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr>
                  <td colspan="2" style="padding: 10px; text-align: right;">Subtotal:</td>
                  <td style="padding: 10px; text-align: right;">$${data.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 10px; text-align: right;">Delivery (${data.deliveryType}):</td>
                  <td style="padding: 10px; text-align: right;">$${data.deliveryFee.toFixed(2)}</td>
                </tr>
                ${data.discount > 0 ? `
                <tr>
                  <td colspan="2" style="padding: 10px; text-align: right; color: #22C55E;">Discount:</td>
                  <td style="padding: 10px; text-align: right; color: #22C55E;">-$${data.discount.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                  <td colspan="2" style="padding: 10px; text-align: right; border-top: 2px solid #ddd;">Total:</td>
                  <td style="padding: 10px; text-align: right; border-top: 2px solid #ddd;">$${data.total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p><strong>Delivery Address:</strong><br>${data.deliveryAddress}</p>
          ${data.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>` : ''}
          
          <p>Your order is being reviewed by our pharmacist. We'll notify you once it's approved.</p>
          
          <a href="${data.trackingUrl}" class="button">Track Your Order</a>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} JetMed. All rights reserved.</p>
          <p>Questions? Contact us at support@jetmed.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Order Confirmed! #${data.orderId}`,
    html,
    fromName: FROM_NAME_ORDERS,
    categories: ['order-confirmation', 'transactional'],
  });
};

/**
 * Send prescription approved notification
 */
export const sendPrescriptionApproved = async (
  email: string,
  name: string,
  orderId: string,
  trackingUrl: string
): Promise<boolean> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #22C55E; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #eee; }
        .button { display: inline-block; background: #0066FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Prescription Approved!</h1>
        </div>
        <div class="content">
          <h2>Great news, ${name}!</h2>
          <p>Your prescription for order <strong>#${orderId}</strong> has been verified and approved by our pharmacist.</p>
          <p>Your medicines are now being packed and will be dispatched soon!</p>
          <a href="${trackingUrl}" class="button">Track Your Order</a>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} JetMed. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Prescription Approved! Order #${orderId}`,
    html,
    fromName: FROM_NAME_ORDERS,
    categories: ['prescription-approved', 'transactional'],
  });
};

/**
 * Send invoice email with PDF attachment
 */
export const sendInvoice = async (data: InvoiceEmailData): Promise<boolean> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1E293B; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #eee; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📄 Your Invoice</h1>
        </div>
        <div class="content">
          <h2>Hi ${data.customerName},</h2>
          <p>Please find attached your invoice for order <strong>#${data.orderId}</strong>.</p>
          <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
          <p><strong>Date:</strong> ${data.invoiceDate}</p>
          <p><strong>Amount:</strong> $${data.total.toFixed(2)}</p>
          <p><strong>Payment Status:</strong> ${data.paymentStatus}</p>
          <p>Thank you for choosing JetMed!</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} JetMed. All rights reserved.</p>
          <p>This is an automatically generated invoice.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const attachments = data.invoicePdf ? [{
    content: data.invoicePdf,
    filename: `JetMed_Invoice_${data.invoiceNumber}.pdf`,
    type: 'application/pdf',
    disposition: 'attachment' as const,
  }] : undefined;

  return sendEmail({
    to: data.customerEmail,
    subject: `Invoice for Order #${data.orderId}`,
    html,
    attachments,
    fromName: FROM_NAME_ORDERS,
    categories: ['invoice', 'transactional'],
  });
};

// ============================================
// STAFF NOTIFICATIONS
// ============================================

/**
 * Notify pharmacist of new prescription
 */
export const notifyPharmacistNewPrescription = async (
  email: string,
  pharmacistName: string,
  orderId: string,
  urgency: string,
  dashboardUrl: string
): Promise<boolean> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${urgency === 'emergency' ? '#EF4444' : urgency === 'express' ? '#F59E0B' : '#0066FF'}; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 20px; }
        .content { background: #fff; padding: 20px; border: 1px solid #eee; }
        .button { display: inline-block; background: #0066FF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${urgency === 'emergency' ? '🚨 URGENT' : urgency === 'express' ? '⚡ EXPRESS' : '📋'} New Prescription to Review</h1>
        </div>
        <div class="content">
          <p>Hi ${pharmacistName},</p>
          <p>A new prescription is awaiting your review for order <strong>#${orderId}</strong>.</p>
          <p><strong>Priority:</strong> ${urgency.toUpperCase()}</p>
          <a href="${dashboardUrl}" class="button">Review Now</a>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${urgency === 'emergency' ? '🚨 URGENT: ' : ''}New Prescription to Review - Order #${orderId}`,
    html,
    fromName: FROM_NAME_NOTIFICATIONS,
    categories: ['pharmacist-notification', 'internal'],
  });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Strip HTML tags for plain text version
 */
const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

/**
 * Validate SendGrid configuration
 */
export const validateConfiguration = (): boolean => {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SendGrid API key not configured. Set SENDGRID_API_KEY');
    return false;
  }
  return true;
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Core
  sendEmail,
  sendBulkEmail,

  // Auth emails
  sendWelcomeEmail,
  sendEmailVerification,
  sendPasswordReset,

  // Order emails
  sendOrderConfirmation,
  sendPrescriptionApproved,
  sendInvoice,

  // Staff notifications
  notifyPharmacistNewPrescription,

  // Utilities
  validateConfiguration,
};
