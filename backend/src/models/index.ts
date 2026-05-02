// ============================================
// JetMed Database Models Index
// ============================================

import User from './User.js';
import UserProfile from './UserProfile.js';
import UserMedicalInfo from './UserMedicalInfo.js';
import Address from './Address.js';
import Medicine from './Medicine.js';
import { Warehouse, Inventory } from './Warehouse.js';
import { Order, OrderItem } from './Order.js';
import Prescription from './Prescription.js';
import { Payment, Wallet, WalletTransaction } from './Payment.js';
import { DeliveryPartner, DeliveryEarnings } from './DeliveryPartner.js';
import AppSetting from './AppSetting.js';

// ==================== ASSOCIATIONS ====================

// User associations
User.hasOne(UserProfile, { foreignKey: 'userId', as: 'profile' });
UserProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(UserMedicalInfo, { foreignKey: 'userId', as: 'medicalInfo' });
UserMedicalInfo.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Prescription, { foreignKey: 'userId', as: 'prescriptions' });
Prescription.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(DeliveryPartner, { foreignKey: 'userId', as: 'deliveryPartnerProfile' });
DeliveryPartner.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Medicine associations
Medicine.hasMany(Inventory, { foreignKey: 'medicineId', as: 'inventoryItems' });
Inventory.belongsTo(Medicine, { foreignKey: 'medicineId', as: 'medicine' });

// Warehouse associations
Warehouse.hasMany(Inventory, { foreignKey: 'warehouseId', as: 'inventoryItems' });
Inventory.belongsTo(Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });

Warehouse.hasMany(Order, { foreignKey: 'warehouseId', as: 'orders' });
Order.belongsTo(Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });

// Order associations
Order.belongsTo(Address, { foreignKey: 'addressId', as: 'deliveryAddress' });
Address.hasMany(Order, { foreignKey: 'addressId', as: 'orders' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'orderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Order.hasMany(Payment, { foreignKey: 'orderId', as: 'payments' });
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Order.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });
Order.belongsTo(User, { foreignKey: 'packedBy', as: 'packer' });
Order.belongsTo(User, { foreignKey: 'deliveryPartnerId', as: 'deliveryPartner' });

// OrderItem associations
OrderItem.belongsTo(Medicine, { foreignKey: 'medicineId', as: 'medicine' });
Medicine.hasMany(OrderItem, { foreignKey: 'medicineId', as: 'orderItems' });

// Payment associations
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });

// Wallet associations
Wallet.hasMany(WalletTransaction, { foreignKey: 'walletId', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });

// Prescription associations
Prescription.belongsTo(User, { foreignKey: 'verifiedBy', as: 'verifier' });
Prescription.belongsTo(Order, { foreignKey: 'usedInOrderId', as: 'usedInOrder' });

// Delivery Partner associations
DeliveryPartner.hasMany(DeliveryEarnings, { foreignKey: 'deliveryPartnerId', as: 'earnings' });
DeliveryEarnings.belongsTo(DeliveryPartner, { foreignKey: 'deliveryPartnerId', as: 'deliveryPartner' });

DeliveryEarnings.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Order.hasOne(DeliveryEarnings, { foreignKey: 'orderId', as: 'deliveryEarning' });

// ==================== EXPORTS ====================

export {
  User,
  UserProfile,
  UserMedicalInfo,
  Address,
  Medicine,
  Warehouse,
  Inventory,
  Order,
  OrderItem,
  Prescription,
  Payment,
  Wallet,
  WalletTransaction,
  DeliveryPartner,
  DeliveryEarnings,
  AppSetting,
};

export default {
  User,
  UserProfile,
  UserMedicalInfo,
  Address,
  Medicine,
  Warehouse,
  Inventory,
  Order,
  OrderItem,
  Prescription,
  Payment,
  Wallet,
  WalletTransaction,
  DeliveryPartner,
  DeliveryEarnings,
  AppSetting,
};
