import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  XMarkIcon,
  ChevronDownIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import api from '../../services/api';
import { isProductionMissingRemoteApi } from '../../config/runtime';
import { useAppDispatch } from '../../features/hooks';
import { addToCart } from '../../features/cart/cartSlice';

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  slug: string;
  type: string;
  images: string[];
  dosageOptions: { id: string; strength: string; unit: string; price: number }[];
  prescriptionRequirement: string;
  rating?: number;
  reviewCount?: number;
  isVegan?: boolean;
  isSugarFree?: boolean;
  isGlutenFree?: boolean;
}

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'name_asc', label: 'Name: A-Z' },
  { value: 'name_desc', label: 'Name: Z-A' },
];

const prescriptionFilters = [
  { value: 'all', label: 'All' },
  { value: 'otc', label: 'OTC Only' },
  { value: 'prescription_required', label: 'Prescription Only' },
];

// Placeholder image for medicines without images
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop';

export default function MedicineList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useAppDispatch();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [actionError, setActionError] = useState('');
  const [categories, setCategories] = useState<string[]>(['All Categories']);
  const [mobileCategory, setMobileCategory] = useState('All Categories');
  const [mobilePrescriptionFilter, setMobilePrescriptionFilter] = useState('all');

  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All Categories');
  const [selectedSort, setSelectedSort] = useState(searchParams.get('sort') || 'relevance');
  const [prescriptionFilter, setPrescriptionFilter] = useState(searchParams.get('rx') || 'all');

  const limit = 12;

  useEffect(() => {
    const nextSearch = searchParams.get('search') || '';
    const nextCategory = searchParams.get('category') || 'All Categories';
    const nextSort = searchParams.get('sort') || 'relevance';
    const nextRx = searchParams.get('rx') || 'all';
    const nextPage = Number(searchParams.get('page') || '1');

    setSearchQuery(nextSearch);
    setSelectedCategory(nextCategory);
    setSelectedSort(nextSort);
    setPrescriptionFilter(nextRx);
    setCurrentPage(Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1);
  }, [searchParams]);

  useEffect(() => {
    if (!showFilters) return;
    setMobileCategory(selectedCategory);
    setMobilePrescriptionFilter(prescriptionFilter);
  }, [showFilters, selectedCategory, prescriptionFilter]);

  useEffect(() => {
    fetchMedicines();
  }, [currentPage, selectedCategory, selectedSort, prescriptionFilter, searchParams]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/medicines/categories');
      const fetchedCategories: string[] = response.data.data?.categories || [];
      setCategories(['All Categories', ...fetchedCategories]);
    } catch (error) {
      console.error('Failed to fetch medicine categories:', error);
    }
  };

  const fetchMedicines = async () => {
    setLoading(true);
    setActionError('');
    if (isProductionMissingRemoteApi()) {
      setActionError(
        'API base URL missing: set VITE_API_URL in Vercel (Production) to https://your-api.onrender.com/api/v1 and redeploy.'
      );
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', limit.toString());
      
      if (searchQuery) params.set('search', searchQuery);
      if (selectedCategory !== 'All Categories') params.set('category', selectedCategory);
      if (selectedSort !== 'relevance') params.set('sort', selectedSort);
      if (prescriptionFilter !== 'all') params.set('prescriptionRequirement', prescriptionFilter);

      const response = await api.get(`/medicines?${params.toString()}`);
      setMedicines(response.data.data?.medicines || []);
      setTotalCount(response.data.data?.total || 0);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
      if (axios.isAxiosError(error)) {
        if (error.message === 'Network Error') {
          setActionError(
            'Cannot reach API (often CORS or wrong URL). Confirm VITE_API_URL on Vercel and FRONTEND_URL on Render = this site\'s URL, then redeploy both.'
          );
        } else if (error.response?.data?.message) {
          setActionError(String(error.response.data.message));
        } else {
          setActionError(
            'Unable to load medicines right now. Please refresh or try again shortly.'
          );
        }
      } else {
        setActionError('Unable to load medicines right now. Please refresh or try again shortly.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (medicine: Medicine, dosageOption: Medicine['dosageOptions'][0]) => {
    if (!dosageOption) {
      setActionError('This medicine is temporarily unavailable for purchase.');
      return;
    }
    dispatch(addToCart({
      id: `${medicine.id}-${dosageOption.id}`,
      medicineId: medicine.id,
      name: medicine.name,
      genericName: medicine.genericName,
      image: medicine.images?.[0] || PLACEHOLDER_IMAGE,
      slug: medicine.slug,
      dosageOption: {
        id: dosageOption.id,
        strength: dosageOption.strength,
        unit: dosageOption.unit,
        price: dosageOption.price,
      },
      quantity: 1,
      prescriptionRequired: medicine.prescriptionRequirement === 'prescription_required',
    }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All Categories');
    setSelectedSort('relevance');
    setPrescriptionFilter('all');
    setSearchParams({});
    setCurrentPage(1);
  };

  const updateQueryParam = (key: string, value: string, defaultValue?: string) => {
    const params = new URLSearchParams(searchParams);
    if (!value || (defaultValue !== undefined && value === defaultValue)) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery ||
      selectedCategory !== 'All Categories' ||
      prescriptionFilter !== 'all'
    );
  }, [searchQuery, selectedCategory, prescriptionFilter]);

  const totalPages = Math.ceil(totalCount / limit);
  const visiblePages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set<number>([1, totalPages, currentPage]);
    if (currentPage > 1) pages.add(currentPage - 1);
    if (currentPage < totalPages) pages.add(currentPage + 1);
    if (currentPage > 3) pages.add(2);
    if (currentPage < totalPages - 2) pages.add(totalPages - 1);

    return Array.from(pages).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  // Get medicine image with fallback
  const getMedicineImage = (medicine: Medicine) => {
    if (medicine.images && medicine.images.length > 0 && medicine.images[0]) {
      return medicine.images[0];
    }
    return PLACEHOLDER_IMAGE;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3 md:ml-auto">
              {/* Filter Toggle (Mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg md:hidden"
              >
                <FunnelIcon className="w-5 h-5" />
                Filters
                {hasActiveFilters && <span className="w-2 h-2 bg-primary-500 rounded-full" />}
              </button>

              {/* View Mode Toggle */}
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                >
                  <Squares2X2Icon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                >
                  <ListBulletIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                <select
                  value={selectedSort}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedSort(value);
                    updateQueryParam('sort', value, 'relevance');
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {searchQuery && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="rounded-full bg-primary-50 px-3 py-1 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                Search: {searchQuery}
              </span>
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete('search');
                  params.set('page', '1');
                  setSearchParams(params);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar Filters (Desktop) */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sticky top-36">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700">
                    Clear all
                  </button>
                )}
              </div>

              {/* Categories */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</h4>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setCurrentPage(1);
                        updateQueryParam('category', cat, 'All Categories');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                        selectedCategory === cat
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prescription Filter */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prescription</h4>
                <div className="space-y-1">
                  {prescriptionFilters.map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => {
                        setPrescriptionFilter(filter.value);
                        setCurrentPage(1);
                        updateQueryParam('rx', filter.value, 'all');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                        prescriptionFilter === filter.value
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Focused filters: category, prescription type, and sort.
              </p>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Results Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loading ? 'Loading...' : `${totalCount} products found`}
              </p>
            </div>

            {actionError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {actionError}
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
                    <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                  </div>
                ))}
              </div>
            ) : medicines.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No medicines found</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Try adjusting your filters or search terms
                </p>
                <button onClick={clearFilters} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  Clear Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {medicines.map((medicine, index) => (
                    <motion.div
                      key={medicine.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition p-4"
                    >
                      <Link to={`/medicines/${medicine.slug}`}>
                        <div className="w-full h-40 bg-gray-100 dark:bg-gray-700 rounded-xl mb-4 overflow-hidden">
                          <img
                            src={getMedicineImage(medicine)}
                            alt={medicine.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                            }}
                          />
                        </div>
                      </Link>
                      <div className="flex items-start justify-between mb-2">
                        <Link to={`/medicines/${medicine.slug}`} className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 hover:text-primary-600">
                            {medicine.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{medicine.genericName}</p>
                        </Link>
                        {medicine.prescriptionRequirement === 'prescription_required' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full ml-2">Rx</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mb-3">{medicine.category}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-primary-600">
                          ${medicine.dosageOptions?.[0]?.price?.toFixed(2) || '0.00'}
                        </p>
                        <button
                          onClick={() => handleAddToCart(medicine, medicine.dosageOptions?.[0])}
                          className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                        >
                          <ShoppingCartIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-4">
                {medicines.map((medicine, index) => (
                  <motion.div
                    key={medicine.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition p-4 flex gap-4"
                  >
                    <Link to={`/medicines/${medicine.slug}`} className="flex-shrink-0">
                      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden">
                        <img
                          src={getMedicineImage(medicine)}
                          alt={medicine.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                          }}
                        />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <Link to={`/medicines/${medicine.slug}`}>
                          <h3 className="font-semibold text-gray-900 dark:text-white hover:text-primary-600">
                            {medicine.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{medicine.genericName}</p>
                        </Link>
                        {medicine.prescriptionRequirement === 'prescription_required' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Rx</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{medicine.category}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xl font-bold text-primary-600">
                          ${medicine.dosageOptions?.[0]?.price?.toFixed(2) || '0.00'}
                        </p>
                        <button
                          onClick={() => handleAddToCart(medicine, medicine.dosageOptions?.[0])}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => {
                    const nextPage = Math.max(1, currentPage - 1);
                    setCurrentPage(nextPage);
                    const params = new URLSearchParams(searchParams);
                    params.set('page', String(nextPage));
                    setSearchParams(params);
                  }}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                {visiblePages.map((page, index) => {
                  const previous = visiblePages[index - 1];
                  const showGap = previous !== undefined && page - previous > 1;
                  return (
                    <div key={page} className="flex items-center gap-2">
                      {showGap && <span className="px-1 text-gray-400">...</span>}
                      <button
                        onClick={() => {
                          setCurrentPage(page);
                          const params = new URLSearchParams(searchParams);
                          params.set('page', String(page));
                          setSearchParams(params);
                        }}
                        className={`w-10 h-10 rounded-lg ${
                          currentPage === page
                            ? 'bg-primary-500 text-white'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    const nextPage = Math.min(totalPages, currentPage + 1);
                    setCurrentPage(nextPage);
                    const params = new URLSearchParams(searchParams);
                    params.set('page', String(nextPage));
                    setSearchParams(params);
                  }}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Modal */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={() => setShowFilters(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
                <button onClick={() => setShowFilters(false)}>
                  <XMarkIcon className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Categories */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Category</h4>
                  <div className="space-y-1">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setMobileCategory(cat)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                          mobileCategory === cat 
                            ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prescription */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Prescription</h4>
                  <div className="space-y-1">
                    {prescriptionFilters.map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => setMobilePrescriptionFilter(filter.value)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                          mobilePrescriptionFilter === filter.value 
                            ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button 
                  onClick={() => {
                    clearFilters();
                    setMobileCategory('All Categories');
                    setMobilePrescriptionFilter('all');
                    setShowFilters(false);
                  }} 
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  Clear
                </button>
                <button 
                  onClick={() => {
                    setSelectedCategory(mobileCategory);
                    setPrescriptionFilter(mobilePrescriptionFilter);
                    updateQueryParam('category', mobileCategory, 'All Categories');
                    updateQueryParam('rx', mobilePrescriptionFilter, 'all');
                    setShowFilters(false);
                  }} 
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}