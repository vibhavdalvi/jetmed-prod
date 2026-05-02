// @ts-nocheck
import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';

import { Medicine } from '../models/index.js';
import { asyncHandler, BadRequestError } from '../middleware/errorHandler.js';
import { searchMedicines, getAutocompleteSuggestions } from '../config/elasticsearch.js';
import { M } from '../utils/mongoQuery.js';

const router = Router();

/**
 * @route   GET /api/v1/search
 * @desc    Global search (medicines, etc.)
 */
router.get('/', [
  query('q').isLength({ min: 2 }).withMessage('Query must be at least 2 characters'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { q, type = 'all', limit = '10' } = req.query;
  const limitNum = Math.min(parseInt(limit as string) || 10, 50);

  const results: any = {};

  if (type === 'all' || type === 'medicines') {
    try {
      const esResults = await searchMedicines(q as string, {});
      results.medicines = esResults.slice(0, limitNum);
    } catch {
      const medicines = await Medicine.find({
        isActive: true,
        $or: [
          { name: M.iLike(q as string) },
          { genericName: M.iLike(q as string) },
          { category: M.iLike(q as string) },
        ],
      })
        .select('id name genericName slug category prescriptionRequirement dosageOptions images')
        .limit(limitNum)
        .lean();
      results.medicines = medicines;
    }
  }

  res.json({ success: true, data: results });
}));

/**
 * @route   GET /api/v1/search/suggestions
 * @desc    Get search suggestions (autocomplete)
 */
router.get('/suggestions', [
  query('q').isLength({ min: 2 }),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { q } = req.query;

  try {
    const suggestions = await getAutocompleteSuggestions(q as string);
    res.json({ success: true, data: { suggestions } });
  } catch {
    const medicines = await Medicine.find({
      isActive: true,
      $or: [{ name: M.startsWith(q as string) }, { genericName: M.startsWith(q as string) }],
    })
      .select('id name genericName slug category')
      .sort({ name: 1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        suggestions: medicines.map((m: any) => ({
          id: m.id ?? m._id,
          text: m.name,
          subtext: m.genericName,
          slug: m.slug,
          category: m.category,
        })),
      },
    });
  }
}));

/**
 * @route   GET /api/v1/search/popular
 * @desc    Get popular search terms
 */
router.get('/popular', asyncHandler(async (_req: Request, res: Response) => {
  const popularTerms = [
    'Tylenol',
    'Advil',
    'Benadryl',
    'Zyrtec',
    'Vitamins',
    'Pain relief',
    'Allergy medicine',
    'Cold medicine',
  ];

  res.json({ success: true, data: { terms: popularTerms } });
}));

/**
 * @route   GET /api/v1/search/categories
 * @desc    Get all categories
 */
router.get('/categories', asyncHandler(async (_req: Request, res: Response) => {
  const rows = await Medicine.distinct('category', { isActive: true });
  res.json({
    success: true,
    data: { categories: (rows as string[]).filter(Boolean).sort() },
  });
}));

export default router;
