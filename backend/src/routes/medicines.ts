// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';

import { Medicine, OrderItem, Order } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { uploadMedicineImages, getFileUrl } from '../middleware/upload.js';
import { cacheGet, cacheSet, cacheDelete } from '../config/redis.js';
import { searchMedicines, indexMedicine, deleteMedicineFromIndex } from '../config/elasticsearch.js';
import { UserRole, PrescriptionRequirement, MedicineType, OrderStatus } from '../types/index.js';
import { M } from '../utils/mongoQuery.js';

const router = Router();

const LIST_FIELDS =
  'name genericName slug category type prescriptionRequirement dosageOptions images createdAt';

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      page = '1',
      limit = '12',
      search,
      category,
      type,
      prescriptionRequirement,
      sort = 'relevance',
      isVegan,
      isSugarFree,
      isGlutenFree,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 12, 50);
    const offset = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { isActive: true };

    if (category && category !== 'All Categories') {
      const c = String(category).trim();
      if (c) filter.category = c;
    }

    if (type) {
      filter.type = type;
    }

    if (prescriptionRequirement) {
      if (prescriptionRequirement === 'otc') {
        filter.prescriptionRequirement = PrescriptionRequirement.OTC;
      } else if (
        prescriptionRequirement === 'prescription' ||
        prescriptionRequirement === PrescriptionRequirement.PRESCRIPTION_REQUIRED
      ) {
        filter.prescriptionRequirement = PrescriptionRequirement.PRESCRIPTION_REQUIRED;
      }
    }

    if (isVegan === 'true') filter.isVegan = true;
    if (isSugarFree === 'true') filter.isSugarFree = true;
    if (isGlutenFree === 'true') filter.isGlutenFree = true;

    if (search) {
      try {
        const esResults = await searchMedicines(search as string, {});
        const medicineIds = esResults.hits?.map((r: any) => r.id) || [];
        if (medicineIds.length === 0) {
          return res.json({ success: true, data: { medicines: [], total: 0, page: pageNum, totalPages: 0 } });
        }
        filter._id = M.in(medicineIds);
      } catch {
        filter.$or = [{ name: M.iLike(String(search)) }, { genericName: M.iLike(String(search)) }];
      }
    }

    let medicines: any[] = [];
    let count = 0;

    const orderColl = Order.collection.collectionName;

    if (sort === 'popular') {
      const popularRows = await OrderItem.aggregate([
        { $lookup: { from: orderColl, localField: 'orderId', foreignField: '_id', as: 'ord' } },
        { $unwind: '$ord' },
        { $match: { 'ord.status': { $nin: [OrderStatus.CANCELLED] } } },
        { $group: { _id: '$medicineId', totalUnits: { $sum: '$quantity' } } },
        { $sort: { totalUnits: -1 } },
      ]);

      const rankedIds = popularRows.map((row: any) => row._id);
      count = await Medicine.countDocuments(filter);

      if (rankedIds.length > 0) {
        const matchingIds = new Set(
          (
            await Medicine.find({ ...filter, _id: M.in(rankedIds) })
              .select('_id')
              .lean()
          ).map((m: any) => String(m._id))
        );

        const rankedFilteredIds = rankedIds.filter((id: string) => matchingIds.has(String(id)));
        const dummy = '00000000-0000-0000-0000-000000000000';
        const fallbackRows = await Medicine.find({
          ...filter,
          _id: rankedFilteredIds.length ? M.nin(rankedFilteredIds) : M.ne(dummy),
        })
          .select('_id')
          .sort({ createdAt: -1 })
          .lean();

        const orderedIds = [...rankedFilteredIds, ...fallbackRows.map((m: any) => String(m._id))];
        const pageIds = orderedIds.slice(offset, offset + limitNum);

        if (pageIds.length > 0) {
          const rows = await Medicine.find({ _id: M.in(pageIds) }).select(LIST_FIELDS);
          const byId = new Map(rows.map((row: any) => [String(row._id), row]));
          medicines = pageIds.map((id: string) => byId.get(id)).filter(Boolean);
        }
      } else {
        const fallback = await Medicine.find(filter)
          .select(LIST_FIELDS)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limitNum);
        medicines = fallback;
        count = await Medicine.countDocuments(filter);
      }
    } else if (sort === 'price_low' || sort === 'price_high') {
      const defaultHigh = sort === 'price_low' ? 999999 : 0;
      const sortDir = sort === 'price_low' ? 1 : -1;
      const pipeline: object[] = [
        { $match: filter },
        {
          $addFields: {
            sortPrice: {
              $toDouble: {
                $ifNull: [{ $arrayElemAt: ['$dosageOptions.price', 0] }, defaultHigh],
              },
            },
          },
        },
        { $sort: { sortPrice: sortDir } },
        {
          $facet: {
            data: [{ $skip: offset }, { $limit: limitNum }],
            totalCount: [{ $count: 'count' }],
          },
        },
      ];
      const agg = await Medicine.aggregate(pipeline);
      const facet = agg[0] || { data: [], totalCount: [] };
      medicines = facet.data;
      count = facet.totalCount[0]?.count ?? 0;
    } else {
      let sortSpec: Record<string, 1 | -1> = { createdAt: -1 };
      if (sort === 'name_asc') sortSpec = { name: 1 };
      if (sort === 'name_desc') sortSpec = { name: -1 };
      if (sort === 'newest') sortSpec = { createdAt: -1 };

      count = await Medicine.countDocuments(filter);
      medicines = await Medicine.find(filter).select(LIST_FIELDS).sort(sortSpec).skip(offset).limit(limitNum);
    }

    res.json({
      success: true,
      data: { medicines, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) },
    });
  })
);

router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = 'medicine:categories';
    const cached = await cacheGet(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Do not trust cached empty lists: DB may have been seeded after an earlier empty snapshot.
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sorted = [...parsed].map((c) => String(c)).sort((a, b) => a.localeCompare(b));
          return res.json({ success: true, data: { categories: sorted } });
        }
      } catch {
        await cacheDelete(cacheKey);
      }
    }

    const raw = await Medicine.distinct('category', { isActive: true });
    const categoryList = [
      ...new Set(
        raw
          .filter((c) => c != null && String(c).trim() !== '')
          .map((c) => String(c).trim())
      ),
    ].sort((a, b) => a.localeCompare(b));

    if (categoryList.length > 0) {
      await cacheSet(cacheKey, JSON.stringify(categoryList), 3600);
    } else {
      await cacheDelete(cacheKey);
    }

    res.json({ success: true, data: { categories: categoryList } });
  })
);

router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;

    const medicine = await Medicine.findOne({ slug, isActive: true }).populate({
      path: 'inventoryItems',
      populate: { path: 'warehouse', select: 'name city' },
    });

    if (!medicine) {
      throw new NotFoundError('Medicine not found');
    }

    const relatedMedicines = await Medicine.find({
      category: medicine.category,
      _id: M.ne(medicine.id),
      isActive: true,
    })
      .select('name genericName slug dosageOptions images prescriptionRequirement')
      .limit(4);

    res.json({ success: true, data: { medicine, relatedMedicines } });
  })
);

router.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN_SUPER, UserRole.ADMIN_CONTENT),
  uploadMedicineImages,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('genericName').trim().notEmpty().withMessage('Generic name is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('type').isIn(Object.values(MedicineType)).withMessage('Invalid type'),
    body('prescriptionRequirement').isIn(Object.values(PrescriptionRequirement)).withMessage('Invalid prescription requirement'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const {
      name,
      genericName,
      category,
      type,
      prescriptionRequirement,
      description,
      manufacturer,
      dosageOptions,
      activeIngredients,
      uses,
      sideEffects,
      warnings,
      storageInstructions,
      isVegan = false,
      isSugarFree = false,
      isAlcoholFree = true,
      isPregnancySafe = false,
      isLactationSafe = false,
      isGlutenFree = true,
    } = req.body;

    const images: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        images.push(getFileUrl(file.path));
      }
    }

    const medicine = await Medicine.create({
      name,
      genericName,
      category,
      type,
      prescriptionRequirement,
      description,
      manufacturer,
      dosageOptions: typeof dosageOptions === 'string' ? JSON.parse(dosageOptions) : dosageOptions || [],
      activeIngredients: typeof activeIngredients === 'string' ? JSON.parse(activeIngredients) : activeIngredients || [],
      uses: typeof uses === 'string' ? JSON.parse(uses) : uses || [],
      sideEffects: typeof sideEffects === 'string' ? JSON.parse(sideEffects) : sideEffects || [],
      warnings: typeof warnings === 'string' ? JSON.parse(warnings) : warnings || [],
      contraindications: [],
      drugInteractions: [],
      storageInstructions: storageInstructions || 'Store in a cool, dry place away from direct sunlight.',
      images,
      isVegan: typeof isVegan === 'string' ? isVegan === 'true' : isVegan,
      isSugarFree: typeof isSugarFree === 'string' ? isSugarFree === 'true' : isSugarFree,
      isAlcoholFree: typeof isAlcoholFree === 'string' ? isAlcoholFree === 'true' : isAlcoholFree,
      isPregnancySafe: typeof isPregnancySafe === 'string' ? isPregnancySafe === 'true' : isPregnancySafe,
      isLactationSafe: typeof isLactationSafe === 'string' ? isLactationSafe === 'true' : isLactationSafe,
      isGlutenFree: typeof isGlutenFree === 'string' ? isGlutenFree === 'true' : isGlutenFree,
      isActive: true,
    });

    try {
      await indexMedicine(medicine);
    } catch (error) {
      console.error('Failed to index medicine:', error);
    }

    await cacheDelete('medicine:categories');

    res.status(201).json({ success: true, message: 'Medicine created', data: { medicine } });
  })
);

router.put(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN_SUPER, UserRole.ADMIN_CONTENT),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const medicine = await Medicine.findById(id);
    if (!medicine) {
      throw new NotFoundError('Medicine not found');
    }

    Object.assign(medicine, req.body);
    await medicine.save();

    try {
      await indexMedicine(medicine);
    } catch (error) {
      console.error('Failed to re-index medicine:', error);
    }

    res.json({ success: true, message: 'Medicine updated', data: { medicine } });
  })
);

router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN_SUPER),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const medicine = await Medicine.findById(id);
    if (!medicine) {
      throw new NotFoundError('Medicine not found');
    }

    medicine.isActive = false;
    await medicine.save();

    try {
      await deleteMedicineFromIndex(id);
    } catch (error) {
      console.error('Failed to remove from index:', error);
    }

    res.json({ success: true, message: 'Medicine deleted' });
  })
);

export default router;
