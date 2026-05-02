import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/postgres.js';
import { IPayment, IWallet, IWalletTransaction, PaymentMethod, PaymentStatus } from '../types/index.js';

// ==================== PAYMENT MODEL ====================

interface PaymentCreationAttributes extends Optional<IPayment, 'id' | 'createdAt' | 'updatedAt' | 'stripePaymentIntentId' | 'stripeChargeId' | 'walletTransactionId' | 'cardLast4' | 'cardBrand' | 'failureReason' | 'refundedAmount' | 'refundReason' | 'refundedAt'> {}

class Payment extends Model<IPayment, PaymentCreationAttributes> implements IPayment {
  declare id: string;
  declare orderId: string;
  declare userId: string;
  declare method: PaymentMethod;
  declare status: PaymentStatus;
  declare amount: number;
  declare currency: string;
  declare stripePaymentIntentId?: string;
  declare stripeChargeId?: string;
  declare walletTransactionId?: string;
  declare cardLast4?: string;
  declare cardBrand?: string;
  declare failureReason?: string;
  declare refundedAmount?: number;
  declare refundReason?: string;
  declare refundedAt?: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Payment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    method: {
      type: DataTypes.ENUM(...Object.values(PaymentMethod)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      allowNull: false,
      defaultValue: PaymentStatus.PENDING,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
    },
    stripePaymentIntentId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    stripeChargeId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    walletTransactionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    cardLast4: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    cardBrand: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refundedAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    refundReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refundedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'payments',
    underscored: false,
    timestamps: true,
    indexes: [
      { fields: ['orderId'] },
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['stripePaymentIntentId'] },
      { fields: ['createdAt'] },
    ],
  }
);

// ==================== WALLET MODEL ====================

interface WalletCreationAttributes extends Optional<IWallet, 'id' | 'createdAt' | 'updatedAt' | 'balance'> {}

class Wallet extends Model<IWallet, WalletCreationAttributes> implements IWallet {
  declare id: string;
  declare userId: string;
  declare balance: number;
  declare currency: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Wallet.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'wallets',
    underscored: false,
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
    ],
  }
);

// ==================== WALLET TRANSACTION MODEL ====================

interface WalletTransactionCreationAttributes extends Optional<IWalletTransaction, 'id' | 'createdAt' | 'referenceType' | 'referenceId'> {}

class WalletTransaction extends Model<IWalletTransaction, WalletTransactionCreationAttributes> implements IWalletTransaction {
  declare id: string;
  declare walletId: string;
  declare type: 'credit' | 'debit';
  declare amount: number;
  declare description: string;
  declare referenceType?: string;
  declare referenceId?: string;
  declare balanceAfter: number;
  declare createdAt: Date;
}

WalletTransaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    walletId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'wallets',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    type: {
      type: DataTypes.ENUM('credit', 'debit'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    referenceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    referenceId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'wallet_transactions',
    underscored: false,
    timestamps: false,
    indexes: [
      { fields: ['walletId'] },
      { fields: ['type'] },
      { fields: ['createdAt'] },
      { fields: ['referenceType', 'referenceId'] },
    ],
  }
);

export { Payment, Wallet, WalletTransaction };
