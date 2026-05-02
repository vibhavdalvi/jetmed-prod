import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { literal } from 'sequelize';
import { fn, col } from 'sequelize';
import { body, query, validationResult } from 'express-validator';

import { Medicine, Inventory, Warehouse, OrderItem, Order } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { uploadMedicineImages, getFileUrl } from '../middleware/upload.js';
import { cacheGet, cacheSet, cacheDelete } from '../config/redis.js';
import { searchMedicines, indexMedicine, deleteMedicineFromIndex } from '../config/elasticsearch.js';
import { UserRole, PrescriptionRequirement, MedicineType, OrderStatus } from '../types/index.js';

const router = Router();

/**
 * @route   GET /api/v1/medicines
 * @desc    Get all medicines with filtering, sorting, and pagination
 * @access  Public
 */
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

    const where: any = { isActive: true };

    if (category && category !== 'All Categories') {
      where.category = category;
    }

    if (type) {
      where.type = type;
    }

    if (prescriptionRequirement) {
      if (prescriptionRequirement === 'otc') {
        where.prescriptionRequirement = PrescriptionRequirement.OTC;
      } else if (
        prescriptionRequirement === 'prescription' ||
        prescriptionRequirement === PrescriptionRequirement.PRESCRIPTION_REQUIRED
      ) {
        where.prescriptionRequirement = PrescriptionRequirement.PRESCRIPTION_REQUIRED;
      }
    }

    if (isVegan === 'true') where.isVegan = true;
    if (isSugarFree === 'true') where.isSugarFree = true;
    if (isGlutenFree === 'true') where.isGlutenFree = true;

    // Search
    if (search) {
      try {
        const esResults = await searchMedicines(search as string, {});
        const medicineIds = esResults.hits?.map((r: any) => r.id) || [];
        if (medicineIds.length === 0) {
          return res.json({ success: true, data: { medicines: [], total: 0, page: pageNum, totalPages: 0 } });
        }
        where.id = { [Op.in]: medicineIds };
      } catch {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { genericName: { [Op.iLike]: `%${search}%` } },
        ];
      }
    }

    let medicines: any[] = [];
    let count = 0;

    if (sort === 'popular') {
      const popularRows = await OrderItem.findAll({
        attributes: ['medicineId', [fn('SUM', col('OrderItem.quantity')), 'totalUnits']],
        include: [
          {
            model: Order,
            as: 'order',
            attributes: [],
            required: true,
            where: {
              status: {
                [Op.notIn]: [OrderStatus.CANCELLED],
              },
            },
          },
        ],
        group: ['medicineId'],
        order: [[literal('"totalUnits"'), 'DESC']],
        raw: true,
      });

      const rankedIds = popularRows.map((row: any) => row.medicineId);
      const filteredCount = await Medicine.count({ where });
      count = filteredCount;

      if (rankedIds.length > 0) {
        const matchingIds = new Set(
          (await Medicine.findAll({
            where: { ...where, id: { [Op.in]: rankedIds } },
            attributes: ['id'],
            raw: true,
          })).map((m: any) => m.id)
        );

        const rankedFilteredIds = rankedIds.filter((id: string) => matchingIds.has(id));
        const fallbackRows = await Medicine.findAll({
          where: { ...where, id: { [Op.notIn]: rankedFilteredIds.length > 0 ? rankedFilteredIds : ['00000000-0000-0000-0000-000000000000'] } },
          attributes: ['id'],
          order: [['createdAt', 'DESC']],
          raw: true,
        });

        const orderedIds = [...rankedFilteredIds, ...fallbackRows.map((m: any) => m.id)];
        const pageIds = orderedIds.slice(offset, offset + limitNum);

        if (pageIds.length > 0) {
          const rows = await Medicine.findAll({
            where: { id: { [Op.in]: pageIds } },
            attributes: ['id', 'name', 'genericName', 'slug', 'category', 'type', 'prescriptionRequirement', 'dosageOptions', 'images', 'createdAt'],
          });
          const byId = new Map(rows.map((row: any) => [row.id, row]));
          medicines = pageIds.map((id: string) => byId.get(id)).filter(Boolean);
        }
      } else {
        const fallback = await Medicine.findAndCountAll({
          where,
          order: [['createdAt', 'DESC']],
          limit: limitNum,
          offset,
          attributes: ['id', 'name', 'genericName', 'slug', 'category', 'type', 'prescriptionRequirement', 'dosageOptions', 'images', 'createdAt'],
        });
        medicines = fallback.rows;
        count = fallback.count;
      }
    } else {
      let order: any[] = [['createdAt', 'DESC']];
      if (sort === 'name_asc') order = [['name', 'ASC']];
      if (sort === 'name_desc') order = [['name', 'DESC']];
      if (sort === 'newest') order = [['createdAt', 'DESC']];
      if (sort === 'price_low') {
        order = [[literal(`COALESCE((\"Medicine\".\"dosageOptions\"->0->>'price')::numeric, 999999)`), 'ASC']];
      }
      if (sort === 'price_high') {
        order = [[literal(`COALESCE((\"Medicine\".\"dosageOptions\"->0->>'price')::numeric, 0)`), 'DESC']];
      }

      const result = await Medicine.findAndCountAll({
        where,
        order,
        limit: limitNum,
        offset,
        attributes: ['id', 'name', 'genericName', 'slug', 'category', 'type', 'prescriptionRequirement', 'dosageOptions', 'images', 'createdAt'],
      });
      medicines = result.rows;
      count = result.count;
    }

    res.json({
      success: true,
      data: { medicines, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) },
    });
  })
);

/**
 * @route   GET /api/v1/medicines/categories
 * @desc    Get all medicine categories
 */
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = 'medicine:categories';
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json({ success: true, data: { categories: JSON.parse(cached) } });
    }

    const categories = await Medicine.findAll({
      attributes: ['category'],
      where: { isActive: true },
      group: ['category'],
      raw: true,
    });

    const categoryList = categories.map((c: any) => c.category);
    await cacheSet(cacheKey, JSON.stringify(categoryList), 3600);

    res.json({ success: true, data: { categories: categoryList } });
  })
);

/**
 * @route   GET /api/v1/medicines/:slug
 * @desc    Get medicine by slug
 */
router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;

    const medicine = await Medicine.findOne({
      where: { slug, isActive: true },
      include: [{ model: Inventory, as: 'inventoryItems', include: [{ model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'city'] }] }],
    });

    if (!medicine) {
      throw new NotFoundError('Medicine not found');
    }

    const relatedMedicines = await Medicine.findAll({
      where: { category: medicine.category, id: { [Op.ne]: medicine.id }, isActive: true },
      attributes: ['id', 'name', 'genericName', 'slug', 'dosageOptions', 'images', 'prescriptionRequirement'],
      limit: 4,
    });

    res.json({ success: true, data: { medicine, relatedMedicines } });
  })
);

/**
 * @route   POST /api/v1/medicines
 * @desc    Create medicine (Admin)
 */
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
      // FIX: Include all required boolean fields with defaults
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
      // FIX: Include all required boolean fields
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

/**
 * @route   PUT /api/v1/medicines/:id
 * @desc    Update medicine (Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN_SUPER, UserRole.ADMIN_CONTENT),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const medicine = await Medicine.findByPk(id);
    if (!medicine) {
      throw new NotFoundError('Medicine not found');
    }

    await medicine.update(req.body);

    try {
      await indexMedicine(medicine);
    } catch (error) {
      console.error('Failed to re-index medicine:', error);
    }

    res.json({ success: true, message: 'Medicine updated', data: { medicine } });
  })
);

/**
 * @route   DELETE /api/v1/medicines/:id
 * @desc    Delete medicine (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN_SUPER),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const medicine = await Medicine.findByPk(id);
    if (!medicine) {
      throw new NotFoundError('Medicine not found');
    }

    await medicine.update({ isActive: false });

    try {
      await deleteMedicineFromIndex(id);
    } catch (error) {
      console.error('Failed to remove from index:', error);
    }

    res.json({ success: true, message: 'Medicine deleted' });
  })
);

export default router;