// ============================================
// JetMed TypeScript Type Definitions
// ============================================

// ==================== ENUMS ====================

export enum UserRole {
  CUSTOMER = 'customer',
  PHARMACIST = 'pharmacist',
  SENIOR_PHARMACIST = 'senior_pharmacist',
  DELIVERY_PARTNER = 'delivery_partner',
  WAREHOUSE_STAFF = 'warehouse_staff',
  SUPPORT_AGENT = 'support_agent',
  ADMIN_SUPER = 'admin_super',
  ADMIN_OPERATIONS = 'admin_operations',
  ADMIN_FINANCE = 'admin_finance',
  ADMIN_CONTENT = 'admin_content',
  ADMIN_SUPPORT = 'admin_support',
}

export enum OrderStatus {
  PLACED = 'placed',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  MORE_INFO_NEEDED = 'more_info_needed',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PACKING = 'packing',
  PACKED = 'packed',
  ASSIGNED_TO_DELIVERY = 'assigned_to_delivery',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
  REFUNDED = 'refunded',
}

export enum PrescriptionStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  USED = 'used',
}

export enum MedicineType {
  TABLET = 'tablet',
  CAPSULE = 'capsule',
  SYRUP = 'syrup',
  INJECTION = 'injection',
  CREAM = 'cream',
  OINTMENT = 'ointment',
  GEL = 'gel',
  DROPS = 'drops',
  INHALER = 'inhaler',
  SPRAY = 'spray',
  POWDER = 'powder',
  PATCH = 'patch',
  SUPPOSITORY = 'suppository',
}

export enum PrescriptionRequirement {
  OTC = 'otc',
  PRESCRIPTION_REQUIRED = 'prescription_required',
  CONTROLLED_SUBSTANCE = 'controlled_substance',
}

export enum DeliveryType {
  STANDARD = 'standard',
  EXPRESS = 'express',
  EMERGENCY = 'emergency',
  SCHEDULED = 'scheduled',
}

export enum PaymentMethod {
  CARD = 'card',
  WALLET = 'wallet',
  PAYPAL = 'paypal',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum UrgencyLevel {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING_ON_CUSTOMER = 'waiting_on_customer',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

// ==================== INTERFACES ====================

// User Related
export interface IUser {
  id: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  timezone: string;
  preferences?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMedicalInfo {
  id: string;
  userId: string;
  allergies: string[];
  currentMedications: string[];
  chronicConditions: string[];
  bloodType?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceCardImage?: string;
  governmentIdImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddress {
  id: string;
  userId: string;
  label: string;
  streetAddress: string;
  apartment?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  deliveryInstructions?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Medicine Related
export interface IMedicine {
  id: string;
  name: string;
  genericName: string;
  slug: string;
  description: string;
  manufacturer: string;
  category: string;
  subcategory?: string;
  type: MedicineType;
  prescriptionRequirement: PrescriptionRequirement;
  dosageOptions: IDosageOption[];
  activeIngredients: string[];
  uses: string[];
  sideEffects: string[];
  warnings: string[];
  contraindications: string[];
  drugInteractions: string[];
  storageInstructions: string;
  images: string[];
  isVegan: boolean;
  isSugarFree: boolean;
  isAlcoholFree: boolean;
  isPregnancySafe: boolean;
  isLactationSafe: boolean;
  isGlutenFree: boolean;
  ageRestriction?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDosageOption {
  id: string;
  medicineId: string;
  strength: string;
  unit: string;
  price: number;
  comparePrice?: number;
  sku: string;
  barcode?: string;
  isActive: boolean;
}

export interface IInventory {
  id: string;
  medicineId: string;
  dosageOptionId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  batchNumber: string;
  expiryDate: Date;
  costPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWarehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  deliveryRadius: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Order Related
export interface IOrder {
  id: string;
  orderNumber: string;
  userId: string;
  warehouseId: string;
  addressId: string;
  status: OrderStatus;
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  taxAmount: number;
  discountAmount: number;
  tipAmount: number;
  totalAmount: number;
  deliveryType: DeliveryType;
  scheduledDate?: Date;
  scheduledTimeSlot?: string;
  urgencyLevel: UrgencyLevel;
  prescriptionRequired: boolean;
  prescriptionIds: string[];
  symptomsDescription?: string;
  guidedResponses?: IGuidedResponse;
  pharmacistNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  packedBy?: string;
  packedAt?: Date;
  deliveryPartnerId?: string;
  deliveryStartedAt?: Date;
  deliveredAt?: Date;
  deliveryOTP?: string;
  deliveryProofImage?: string;
  deliveryNotes?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: Date;
  promoCodeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderItem {
  id: string;
  orderId: string;
  medicineId: string;
  dosageOptionId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  prescriptionRequired: boolean;
}

export interface IGuidedResponse {
  symptoms: string;
  symptomsDuration: string;
  previouslyTaken: boolean;
  allergiesConfirmed: boolean;
  additionalNotes?: string;
}

// Prescription Related
export interface IPrescription {
  id: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  status: PrescriptionStatus;
  validityDate?: Date;
  issuedDate?: Date;
  doctorName?: string;
  hospitalName?: string;
  uploadedAt: Date;
  verifiedBy?: string;
  verifiedAt?: Date;
  rejectionReason?: string;
  usedInOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Payment Related
export interface IPayment {
  id: string;
  orderId: string;
  userId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  walletTransactionId?: string;
  cardLast4?: string;
  cardBrand?: string;
  failureReason?: string;
  refundedAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWalletTransaction {
  id: string;
  walletId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  balanceAfter: number;
  createdAt: Date;
}

// Delivery Partner Related
export interface IDeliveryPartner {
  id: string;
  userId: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  licenseExpiryDate: Date;
  documentsVerified: boolean;
  isOnline: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  totalDeliveries: number;
  rating: number;
  totalEarnings: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDeliveryEarnings {
  id: string;
  deliveryPartnerId: string;
  orderId: string;
  baseAmount: number;
  distanceBonus: number;
  timeBonus: number;
  surgeBonus: number;
  tipAmount: number;
  totalAmount: number;
  isPaid: boolean;
  paidAt?: Date;
  createdAt: Date;
}

// Pharmacist Related
export interface IPharmacistProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  licenseExpiryDate: Date;
  specializations: string[];
  isOnShift: boolean;
  totalReviews: number;
  averageRating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPharmacistShift {
  id: string;
  pharmacistId: string;
  date: Date;
  startTime: string;
  endTime: string;
  isConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Communication Related
export interface IConversation {
  id: string;
  orderId: string;
  patientId: string;
  pharmacistId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  isRead: boolean;
  createdAt: Date;
}

export interface ICallLog {
  id: string;
  conversationId: string;
  initiatorId: string;
  receiverId: string;
  callType: 'voice' | 'video';
  status: 'initiated' | 'ringing' | 'answered' | 'ended' | 'missed' | 'declined';
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  recordingUrl?: string;
  agoraChannelId?: string;
  createdAt: Date;
}

// Review Related
export interface IReview {
  id: string;
  userId: string;
  targetType: 'medicine' | 'delivery' | 'pharmacist' | 'order';
  targetId: string;
  orderId?: string;
  rating: number;
  comment?: string;
  isAnonymous: boolean;
  isApproved: boolean;
  adminResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Support Related
export interface ISupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  orderId?: string;
  category: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  attachments?: string[];
  isInternal: boolean;
  createdAt: Date;
}

// Notification Related
export interface INotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  channel: NotificationChannel;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

// Promo Related
export interface IPromoCode {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'flat' | 'free_delivery';
  discountValue: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  validFrom: Date;
  validUntil: Date;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Settings Related
export interface ISystemSettings {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  updatedBy: string;
  updatedAt: Date;
}

// Audit Log
export interface IAuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// API Response Types
export interface IApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
  pagination?: IPagination;
}

export interface IPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// JWT Payload
export interface IJwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Socket Events
export interface ISocketEvents {
  // Order events
  ORDER_STATUS_UPDATED: 'order:status_updated';
  ORDER_ASSIGNED: 'order:assigned';
  
  // Delivery events
  DELIVERY_LOCATION_UPDATED: 'delivery:location_updated';
  DELIVERY_PARTNER_ONLINE: 'delivery:partner_online';
  DELIVERY_PARTNER_OFFLINE: 'delivery:partner_offline';
  
  // Pharmacist events
  NEW_ORDER_IN_QUEUE: 'pharmacist:new_order';
  ESCALATION_RECEIVED: 'pharmacist:escalation';
  
  // Communication events
  NEW_MESSAGE: 'chat:new_message';
  MESSAGE_READ: 'chat:message_read';
  CALL_INCOMING: 'call:incoming';
  CALL_ACCEPTED: 'call:accepted';
  CALL_ENDED: 'call:ended';
  
  // Notification events
  NEW_NOTIFICATION: 'notification:new';
}

// Express Request Extension
declare global {
  namespace Express {
    interface Request {
      user?: IJwtPayload;
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }
  }
}

export {};
