// @ts-nocheck
import slugifyModule from 'slugify';
const slugify = (slugifyModule as unknown as { default?: typeof slugifyModule } & ((s: string, o?: object) => string)).default ?? (slugifyModule as (s: string, o?: object) => string);
import mongoose, { Schema, type Model } from 'mongoose';
import { MedicineType, PrescriptionRequirement } from '../types/index.js';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const medicineSchema = new Schema(
  {
    _id: { ...uuidId },
    name: { type: String, required: true },
    genericName: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    manufacturer: { type: String, required: true },
    category: { type: String, required: true },
    subcategory: String,
    type: { type: String, enum: Object.values(MedicineType), required: true },
    prescriptionRequirement: {
      type: String,
      enum: Object.values(PrescriptionRequirement),
      default: PrescriptionRequirement.OTC,
    },
    dosageOptions: { type: [Schema.Types.Mixed], default: [] },
    activeIngredients: { type: [String], default: [] },
    uses: { type: [String], default: [] },
    sideEffects: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    contraindications: { type: [String], default: [] },
    drugInteractions: { type: [String], default: [] },
    storageInstructions: {
      type: String,
      default: 'Store in a cool, dry place away from direct sunlight.',
    },
    images: { type: [String], default: [] },
    isVegan: { type: Boolean, default: false },
    isSugarFree: { type: Boolean, default: false },
    isAlcoholFree: { type: Boolean, default: true },
    isPregnancySafe: { type: Boolean, default: false },
    isLactationSafe: { type: Boolean, default: false },
    isGlutenFree: { type: Boolean, default: true },
    ageRestriction: Number,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

medicineSchema.pre('validate', function (next) {
  if (this.name && !(this as { slug?: string }).slug) {
    (this as { slug: string }).slug = slugify(String(this.name), { lower: true, strict: true });
  }
  next();
});

medicineSchema.virtual('inventoryItems', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'medicineId',
});

addApiJson(medicineSchema);

medicineSchema.index({ name: 'text', genericName: 'text', category: 'text' });

const Medicine =
  (mongoose.models.Medicine as Model<unknown>) || mongoose.model('Medicine', medicineSchema);
export default Medicine;
