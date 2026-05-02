import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/postgres.js';

interface AppSettingAttributes {
  id: string;
  key: string;
  value: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface AppSettingCreationAttributes
  extends Optional<AppSettingAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class AppSetting
  extends Model<AppSettingAttributes, AppSettingCreationAttributes>
  implements AppSettingAttributes
{
  declare id: string;
  declare key: string;
  declare value: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

AppSetting.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.JSONB,
      allowNull: false,
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
    tableName: 'app_settings',
    underscored: false,
    timestamps: true,
    indexes: [{ fields: ['key'], unique: true }],
  }
);

export default AppSetting;
