import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/postgres.js';
import { IWarehouse, IInventory } from '../types/index.js';

// ==================== WAREHOUSE MODEL ====================

interface WarehouseCreationAttributes extends Optional<IWarehouse, 'id' | 'createdAt' | 'updatedAt'> {}

class Warehouse extends Model<IWarehouse, WarehouseCreationAttributes> implements IWarehouse {
  declare id: string;
  declare name: string;
  declare code: string;
  declare address: string;
  declare city: string;
  declare state: string;
  declare zipCode: string;
  declare latitude: number;
  declare longitude: number;
  declare deliveryRadius: number;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Warehouse.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    zipCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false,
    },
    deliveryRadius: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 25,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: 'warehouses',
    underscored: false,
    timestamps: true,
    indexes: [
      { fields: ['code'], unique: true },
      { fields: ['city', 'state'] },
      { fields: ['isActive'] },
    ],
  }
);

// ==================== INVENTORY MODEL ====================

interface InventoryCreationAttributes extends Optional<IInventory, 'id' | 'createdAt' | 'updatedAt' | 'reservedQuantity'> {}

class Inventory extends Model<IInventory, InventoryCreationAttributes> implements IInventory {
  declare id: string;
  declare medicineId: string;
  declare dosageOptionId: string;
  declare warehouseId: string;
  declare quantity: number;
  declare reservedQuantity: number;
  declare reorderLevel: number;
  declare reorderQuantity: number;
  declare batchNumber: string;
  declare expiryDate: Date;
  declare costPrice: number;
  declare createdAt: Date;
  declare updatedAt: Date;

  get availableQuantity(): number {
    return this.quantity - this.reservedQuantity;
  }

  get needsReorder(): boolean {
    return this.availableQuantity <= this.reorderLevel;
  }

  get expiryStatus(): 'expired' | 'expiring_soon' | 'ok' {
    const now = new Date();
    const expiryDate = new Date(this.expiryDate);
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 90) return 'expiring_soon';
    return 'ok';
  }
}

Inventory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    medicineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'medicines',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    dosageOptionId: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    warehouseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'warehouses',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    reservedQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    reorderLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
    },
    reorderQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 200,
    },
    batchNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    costPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
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
    tableName: 'inventory',
    underscored: false,
    timestamps: true,
    indexes: [
      { fields: ['medicineId'] },
      { fields: ['warehouseId'] },
      { fields: ['dosageOptionId'] },
      { fields: ['expiryDate'] },
      { fields: ['batchNumber'] },
      {
        fields: ['medicineId', 'dosageOptionId', 'warehouseId', 'batchNumber'],
        unique: true,
        name: 'idx_inventory_unique',
      },
    ],
  }
);

export { Warehouse, Inventory };
