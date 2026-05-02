import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/postgres.js';
import { IUserProfile, Gender } from '../types/index.js';

interface UserProfileCreationAttributes extends Optional<IUserProfile, 'id' | 'createdAt' | 'updatedAt' | 'displayName' | 'avatar' | 'dateOfBirth' | 'gender' | 'preferences'> {}

class UserProfile extends Model<IUserProfile, UserProfileCreationAttributes> implements IUserProfile {
  declare id: string;
  declare userId: string;
  declare firstName: string;
  declare lastName: string;
  declare displayName?: string;
  declare avatar?: string;
  declare dateOfBirth?: Date;
  declare gender?: Gender;
  declare timezone: string;
  declare preferences?: Record<string, any>;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Virtual field for full name
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  // Calculate age from DOB
  get age(): number | null {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
}

UserProfile.init(
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
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM(...Object.values(Gender)),
      allowNull: true,
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'America/New_York',
    },
    preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
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
    tableName: 'user_profiles',
    underscored: false,
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
      { fields: ['firstName', 'lastName'] },
    ],
  }
);

export default UserProfile;
