import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/postgres.js';
import { IUserMedicalInfo } from '../types/index.js';

interface UserMedicalInfoCreationAttributes extends Optional<IUserMedicalInfo, 'id' | 'createdAt' | 'updatedAt' | 'allergies' | 'currentMedications' | 'chronicConditions' | 'bloodType' | 'emergencyContactName' | 'emergencyContactPhone' | 'insuranceProvider' | 'insurancePolicyNumber' | 'insuranceCardImage' | 'governmentIdImage'> {}

class UserMedicalInfo extends Model<IUserMedicalInfo, UserMedicalInfoCreationAttributes> implements IUserMedicalInfo {
  declare id: string;
  declare userId: string;
  declare allergies: string[];
  declare currentMedications: string[];
  declare chronicConditions: string[];
  declare bloodType?: string;
  declare emergencyContactName?: string;
  declare emergencyContactPhone?: string;
  declare insuranceProvider?: string;
  declare insurancePolicyNumber?: string;
  declare insuranceCardImage?: string;
  declare governmentIdImage?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

UserMedicalInfo.init(
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
    allergies: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    currentMedications: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    chronicConditions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    bloodType: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        isIn: [['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']],
      },
    },
    emergencyContactName: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    emergencyContactPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    insuranceProvider: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    insurancePolicyNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    insuranceCardImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    governmentIdImage: {
      type: DataTypes.STRING(500),
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
    tableName: 'user_medical_info',
    underscored: false,
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
    ],
  }
);

export default UserMedicalInfo;
