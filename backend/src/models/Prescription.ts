import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/postgres.js';
import { IPrescription, PrescriptionStatus } from '../types/index.js';

interface PrescriptionCreationAttributes extends Optional<IPrescription, 'id' | 'createdAt' | 'updatedAt' | 'validityDate' | 'issuedDate' | 'doctorName' | 'hospitalName' | 'verifiedBy' | 'verifiedAt' | 'rejectionReason' | 'usedInOrderId'> {}

class Prescription extends Model<IPrescription, PrescriptionCreationAttributes> implements IPrescription {
  declare id: string;
  declare userId: string;
  declare fileName: string;
  declare filePath: string;
  declare fileType: string;
  declare status: PrescriptionStatus;
  declare validityDate?: Date;
  declare issuedDate?: Date;
  declare doctorName?: string;
  declare hospitalName?: string;
  declare uploadedAt: Date;
  declare verifiedBy?: string;
  declare verifiedAt?: Date;
  declare rejectionReason?: string;
  declare usedInOrderId?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Check if prescription is valid (not expired)
  get isValid(): boolean {
    if (this.status !== PrescriptionStatus.APPROVED) return false;
    if (!this.validityDate) return true;
    return new Date(this.validityDate) >= new Date();
  }

  // Check if prescription has been used
  get isUsed(): boolean {
    return this.status === PrescriptionStatus.USED || !!this.usedInOrderId;
  }
}

Prescription.init(
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
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    fileType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PrescriptionStatus)),
      allowNull: false,
      defaultValue: PrescriptionStatus.PENDING,
    },
    validityDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    issuedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    doctorName: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    hospitalName: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    uploadedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    usedInOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id',
      },
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
    tableName: 'prescriptions',
    underscored: false,
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['validityDate'] },
      { fields: ['usedInOrderId'] },
      { fields: ['userId', 'status'] },
    ],
  }
);

export default Prescription;
