import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/postgres.js';
import { IDeliveryPartner, IDeliveryEarnings } from '../types/index.js';

// ==================== DELIVERY PARTNER MODEL ====================

interface DeliveryPartnerCreationAttributes extends Optional<IDeliveryPartner, 'id' | 'createdAt' | 'updatedAt' | 'currentLatitude' | 'currentLongitude' | 'totalDeliveries' | 'rating' | 'totalEarnings'> {}

class DeliveryPartner extends Model<IDeliveryPartner, DeliveryPartnerCreationAttributes> implements IDeliveryPartner {
  declare id: string;
  declare userId: string;
  declare vehicleType: string;
  declare vehicleNumber: string;
  declare licenseNumber: string;
  declare licenseExpiryDate: Date;
  declare documentsVerified: boolean;
  declare isOnline: boolean;
  declare currentLatitude?: number;
  declare currentLongitude?: number;
  declare totalDeliveries: number;
  declare rating: number;
  declare totalEarnings: number;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Check if license is valid
  get isLicenseValid(): boolean {
    return new Date(this.licenseExpiryDate) > new Date();
  }

  // Check if can accept orders
  get canAcceptOrders(): boolean {
    return this.documentsVerified && this.isLicenseValid && this.isOnline;
  }
}

DeliveryPartner.init(
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
    vehicleType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    vehicleNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    licenseNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    licenseExpiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    documentsVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isOnline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    currentLatitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    currentLongitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    totalDeliveries: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 5.00,
    },
    totalEarnings: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
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
    tableName: 'delivery_partners',
    underscored: false,
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
      { fields: ['isOnline'] },
      { fields: ['documentsVerified'] },
      { fields: ['currentLatitude', 'currentLongitude'] },
    ],
  }
);

// ==================== DELIVERY EARNINGS MODEL ====================

interface DeliveryEarningsCreationAttributes extends Optional<IDeliveryEarnings, 'id' | 'createdAt' | 'distanceBonus' | 'timeBonus' | 'surgeBonus' | 'tipAmount' | 'isPaid' | 'paidAt'> {}

class DeliveryEarnings extends Model<IDeliveryEarnings, DeliveryEarningsCreationAttributes> implements IDeliveryEarnings {
  declare id: string;
  declare deliveryPartnerId: string;
  declare orderId: string;
  declare baseAmount: number;
  declare distanceBonus: number;
  declare timeBonus: number;
  declare surgeBonus: number;
  declare tipAmount: number;
  declare totalAmount: number;
  declare isPaid: boolean;
  declare paidAt?: Date;
  declare createdAt: Date;
}

DeliveryEarnings.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    deliveryPartnerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'delivery_partners',
        key: 'id',
      },
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id',
      },
    },
    baseAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    distanceBonus: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    timeBonus: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    surgeBonus: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    tipAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'delivery_earnings',
    underscored: false,
    timestamps: false,
    indexes: [
      { fields: ['deliveryPartnerId'] },
      { fields: ['orderId'] },
      { fields: ['isPaid'] },
      { fields: ['createdAt'] },
    ],
  }
);

export { DeliveryPartner, DeliveryEarnings };
