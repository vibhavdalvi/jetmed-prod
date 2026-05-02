import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/postgres.js';
import { IOrder, IOrderItem, IGuidedResponse, OrderStatus, DeliveryType, UrgencyLevel } from '../types/index.js';

// ==================== ORDER MODEL ====================

interface OrderCreationAttributes extends Optional<IOrder, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber' | 'symptomsDescription' | 'guidedResponses' | 'pharmacistNotes' | 'reviewedBy' | 'reviewedAt' | 'packedBy' | 'packedAt' | 'deliveryPartnerId' | 'deliveryStartedAt' | 'deliveredAt' | 'deliveryOTP' | 'deliveryProofImage' | 'deliveryNotes' | 'cancellationReason' | 'cancelledBy' | 'cancelledAt' | 'scheduledDate' | 'scheduledTimeSlot' | 'promoCodeId'> {}

class Order extends Model<IOrder, OrderCreationAttributes> implements IOrder {
  declare id: string;
  declare orderNumber: string;
  declare userId: string;
  declare warehouseId: string;
  declare addressId: string;
  declare status: OrderStatus;
  declare items: IOrderItem[];
  declare subtotal: number;
  declare deliveryFee: number;
  declare platformFee: number;
  declare taxAmount: number;
  declare discountAmount: number;
  declare tipAmount: number;
  declare totalAmount: number;
  declare deliveryType: DeliveryType;
  declare scheduledDate?: Date;
  declare scheduledTimeSlot?: string;
  declare urgencyLevel: UrgencyLevel;
  declare prescriptionRequired: boolean;
  declare prescriptionIds: string[];
  declare symptomsDescription?: string;
  declare guidedResponses?: IGuidedResponse;
  declare pharmacistNotes?: string;
  declare reviewedBy?: string;
  declare reviewedAt?: Date;
  declare packedBy?: string;
  declare packedAt?: Date;
  declare deliveryPartnerId?: string;
  declare deliveryStartedAt?: Date;
  declare deliveredAt?: Date;
  declare deliveryOTP?: string;
  declare deliveryProofImage?: string;
  declare deliveryNotes?: string;
  declare cancellationReason?: string;
  declare cancelledBy?: string;
  declare cancelledAt?: Date;
  declare promoCodeId?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Generate 6-digit OTP
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Generate order number
  static generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `JM-${timestamp}-${random}`;
  }
}

Order.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    warehouseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'warehouses',
        key: 'id',
      },
    },
    addressId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'addresses',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(OrderStatus)),
      allowNull: false,
      defaultValue: OrderStatus.PLACED,
    },
    items: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    deliveryFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    platformFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    taxAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    tipAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    deliveryType: {
      type: DataTypes.ENUM(...Object.values(DeliveryType)),
      allowNull: false,
      defaultValue: DeliveryType.STANDARD,
    },
    scheduledDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    scheduledTimeSlot: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    urgencyLevel: {
      type: DataTypes.ENUM(...Object.values(UrgencyLevel)),
      allowNull: false,
      defaultValue: UrgencyLevel.ROUTINE,
    },
    prescriptionRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    prescriptionIds: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: [],
    },
    symptomsDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    guidedResponses: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    pharmacistNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    packedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    packedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveryPartnerId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    deliveryStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveryOTP: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    deliveryProofImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    deliveryNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancelledBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    promoCodeId: {
      type: DataTypes.UUID,
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
    tableName: 'orders',
    underscored: false,
    timestamps: true,
    hooks: {
      beforeCreate: (order) => {
        if (!order.orderNumber) {
          order.orderNumber = Order.generateOrderNumber();
        }
        if (order.prescriptionRequired && !order.deliveryOTP) {
          order.deliveryOTP = Order.generateOTP();
        }
      },
    },
    indexes: [
      { fields: ['orderNumber'], unique: true },
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['warehouseId'] },
      { fields: ['deliveryPartnerId'] },
      { fields: ['createdAt'] },
      { fields: ['urgencyLevel', 'status'] },
      { fields: ['deliveryType'] },
      {
        fields: ['status', 'urgencyLevel', 'createdAt'],
        name: 'idx_order_queue',
      },
    ],
  }
);

// ==================== ORDER ITEM MODEL ====================

interface OrderItemCreationAttributes extends Optional<IOrderItem, 'id'> {}

class OrderItem extends Model<IOrderItem, OrderItemCreationAttributes> implements IOrderItem {
  declare id: string;
  declare orderId: string;
  declare medicineId: string;
  declare dosageOptionId: string;
  declare quantity: number;
  declare unitPrice: number;
  declare totalPrice: number;
  declare prescriptionRequired: boolean;
}

OrderItem.init(
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
      onDelete: 'CASCADE',
    },
    medicineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'medicines',
        key: 'id',
      },
    },
    dosageOptionId: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    prescriptionRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'order_items',
    underscored: false,
    timestamps: false,
    indexes: [
      { fields: ['orderId'] },
      { fields: ['medicineId'] },
    ],
  }
);

export { Order, OrderItem };
