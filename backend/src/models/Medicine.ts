// @ts-nocheck
import { DataTypes, Model, Optional } from 'sequelize';
import slugify from 'slugify';
import sequelize from '../config/postgres.js';
import { IMedicine, MedicineType, PrescriptionRequirement } from '../types/index.js';

interface MedicineCreationAttributes extends Optional<IMedicine, 'id' | 'createdAt' | 'updatedAt' | 'slug' | 'subcategory' | 'ageRestriction'> {}

class Medicine extends Model<IMedicine, MedicineCreationAttributes> implements IMedicine {
  declare id: string;
  declare name: string;
  declare genericName: string;
  declare slug: string;
  declare description: string;
  declare manufacturer: string;
  declare category: string;
  declare subcategory?: string;
  declare type: MedicineType;
  declare prescriptionRequirement: PrescriptionRequirement;
  declare dosageOptions: any[];
  declare activeIngredients: string[];
  declare uses: string[];
  declare sideEffects: string[];
  declare warnings: string[];
  declare contraindications: string[];
  declare drugInteractions: string[];
  declare storageInstructions: string;
  declare images: string[];
  declare isVegan: boolean;
  declare isSugarFree: boolean;
  declare isAlcoholFree: boolean;
  declare isPregnancySafe: boolean;
  declare isLactationSafe: boolean;
  declare isGlutenFree: boolean;
  declare ageRestriction?: number;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Medicine.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    genericName: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(350),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    manufacturer: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    subcategory: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM(...Object.values(MedicineType)),
      allowNull: false,
    },
    prescriptionRequirement: {
      type: DataTypes.ENUM(...Object.values(PrescriptionRequirement)),
      allowNull: false,
      defaultValue: PrescriptionRequirement.OTC,
    },
    dosageOptions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    activeIngredients: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    uses: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    sideEffects: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    warnings: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    contraindications: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    drugInteractions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    storageInstructions: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'Store in a cool, dry place away from direct sunlight.',
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    isVegan: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isSugarFree: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isAlcoholFree: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isPregnancySafe: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isLactationSafe: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isGlutenFree: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    ageRestriction: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    tableName: 'medicines',
    underscored: false,
    timestamps: true,
    hooks: {
      beforeValidate: (medicine) => {
        if (medicine.name && !medicine.slug) {
          medicine.slug = slugify(medicine.name, { lower: true, strict: true });
        }
      },
    },
    indexes: [
      { fields: ['slug'], unique: true },
      { fields: ['name'] },
      { fields: ['genericName'] },
      { fields: ['category'] },
      { fields: ['type'] },
      { fields: ['prescriptionRequirement'] },
      { fields: ['manufacturer'] },
      { fields: ['isActive'] },
      { 
        fields: ['category', 'type', 'prescriptionRequirement'],
        name: 'idx_medicine_filters',
      },
    ],
  }
);

export default Medicine;
