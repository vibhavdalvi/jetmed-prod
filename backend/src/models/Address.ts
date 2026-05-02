import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/postgres.js';
import { IAddress } from '../types/index.js';

interface AddressCreationAttributes extends Optional<IAddress, 'id' | 'createdAt' | 'updatedAt' | 'apartment' | 'latitude' | 'longitude' | 'deliveryInstructions'> {}

class Address extends Model<IAddress, AddressCreationAttributes> implements IAddress {
  declare id: string;
  declare userId: string;
  declare label: string;
  declare streetAddress: string;
  declare apartment?: string;
  declare city: string;
  declare state: string;
  declare zipCode: string;
  declare country: string;
  declare latitude?: number;
  declare longitude?: number;
  declare deliveryInstructions?: string;
  declare isDefault: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Virtual field for full address
  get fullAddress(): string {
    const parts = [this.streetAddress];
    if (this.apartment) parts.push(this.apartment);
    parts.push(`${this.city}, ${this.state} ${this.zipCode}`);
    parts.push(this.country);
    return parts.join(', ');
  }
}

Address.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    label: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Home',
    },
    streetAddress: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    apartment: {
      type: DataTypes.STRING(100),
      allowNull: true,
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
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'United States',
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    deliveryInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    tableName: 'addresses',
    underscored: false,
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['userId', 'isDefault'] },
      { fields: ['city', 'state'] },
    ],
  }
);

export default Address;
