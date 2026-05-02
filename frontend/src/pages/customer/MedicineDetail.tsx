import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCartIcon,
  TruckIcon,
  ShieldCheckIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAppDispatch } from '../../features/hooks';
import { addToCart } from '../../features/cart/cartSlice';

interface DosageOption {
  id: string;
  strength: string;
  unit: string;
  price: number;
  sku: string;
}

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  slug: string;
  description: string;
  manufacturer: string;
  category: string;
  subcategory?: string;
  type: string;
  prescriptionRequirement: string;
  dosageOptions: DosageOption[];
  activeIngredients: string[];
  uses: string[];
  sideEffects: string[];
  warnings: string[];
  contraindications: string[];
  drugInteractions: string[];
  storageInstructions: string;
  images: string[];
  isVegan: boolean;
  isSugarFree: boolean;
  isAlcoholFree: boolean;
  isPregnancySafe: boolean;
  isLactationSafe: boolean;
  isGlutenFree: boolean;
  ageRestriction?: number;
}

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=600&fit=crop';

export default function MedicineDetail() {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDosage, setSelectedDosage] = useState<DosageOption | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'ingredients' | 'warnings'>('description');

  useEffect(() => {
    fetchMedicine();
  }, [slug]);

  const fetchMedicine = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/medicines/${slug}`);
      const med = response.data.data?.medicine;
      if (!med) {
        throw new Error('Medicine data is unavailable');
      }
      setMedicine(med);
      if (med.dosageOptions?.length > 0) {
        setSelectedDosage(med.dosageOptions[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch medicine:', err);
      setError(err.response?.data?.message || 'Medicine not found');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!medicine || !selectedDosage) return;

    dispatch(addToCart({
      id: `${medicine.id}-${selectedDosage.id}`,
      medicineId: medicine.id,
      name: medicine.name,
      genericName: medicine.genericName,
      image: medicine.images?.[0] || PLACEHOLDER_IMAGE,
      slug: medicine.slug,
      dosageOption: {
        id: selectedDosage.id,
        strength: selectedDosage.strength,
        unit: selectedDosage.unit,
        price: selectedDosage.price,
      },
      quantity,
      prescriptionRequired: medicine.prescriptionRequirement === 'prescription_required',
    }));
  };

  const getImages = () => {
    if (medicine?.images && medicine.images.length > 0) {
      return medicine.images;
    }
    return [PLACEHOLDER_IMAGE];
  };

  const nextImage = () => {
    const images = getImages();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    const images = getImages();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading medicine details...</p>
        </div>
      </div>
    );
  }

  if (error || !medicine) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Medicine Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error || 'The medicine you are looking for does not exist.'}</p>
          <Link
            to="/medicines"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back to Medicines
          </Link>
        </div>
      </div>
    );
  }

  const images = getImages();
  const requiresPrescription = medicine.prescriptionRequirement === 'prescription_required';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link to="/" className="text-gray-500 hover:text-primary-600">Home</Link>
          <span className="text-gray-400">/</span>
          <Link to="/medicines" className="text-gray-500 hover:text-primary-600">Medicines</Link>
          <span className="text-gray-400">/</span>
          <Link to={`/medicines?category=${medicine.category}`} className="text-gray-500 hover:text-primary-600">{medicine.category}</Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-900 dark:text-white">{medicine.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden aspect-square">
              <motion.img
                key={currentImageIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                src={images[currentImageIndex]}
                alt={medicine.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                }}
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-700"
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-700"
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                </>
              )}

              {requiresPrescription && (
                <div className="absolute top-4 left-4 px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                  Prescription Required
                </div>
              )}

            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                      currentImageIndex === idx ? 'border-primary-500' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${medicine.name} ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <p className="text-sm text-primary-600 font-medium mb-1">{medicine.manufacturer}</p>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{medicine.name}</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">{medicine.genericName}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full">
                {medicine.category}
              </span>
              {medicine.type && (
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full capitalize">
                  {medicine.type.replace('_', ' ')}
                </span>
              )}
              {medicine.isVegan && (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">Vegan</span>
              )}
              {medicine.isSugarFree && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">Sugar Free</span>
              )}
              {medicine.isGlutenFree && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded-full">Gluten Free</span>
              )}
            </div>

            {/* Dosage Options */}
            {medicine.dosageOptions && medicine.dosageOptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Dosage
                </label>
                <div className="flex flex-wrap gap-2">
                  {medicine.dosageOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedDosage(option)}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        selectedDosage?.id === option.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      {option.strength}{option.unit}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                ${selectedDosage?.price?.toFixed(2) || '0.00'}
              </span>
              <span className="text-sm text-gray-500">per unit</span>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-lg"
                >
                  <MinusIcon className="w-5 h-5" />
                </button>
                <span className="px-4 py-3 min-w-[60px] text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-lg"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
              >
                <ShoppingCartIcon className="w-5 h-5" />
                Add to Cart - ${((selectedDosage?.price || 0) * quantity).toFixed(2)}
              </button>
            </div>

            {/* Delivery Info */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="text-center">
                <TruckIcon className="w-6 h-6 text-primary-600 mx-auto mb-1" />
                <p className="text-xs text-gray-500">Express Delivery</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">&lt; 1 Hour</p>
              </div>
              <div className="text-center">
                <ShieldCheckIcon className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-gray-500">100% Genuine</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Verified</p>
              </div>
              <div className="text-center">
                <ClockIcon className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <p className="text-xs text-gray-500">Available</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">24/7</p>
              </div>
            </div>

            {/* Prescription Notice */}
            {requiresPrescription && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">Prescription Required</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    You'll need to upload a valid prescription during checkout. Our licensed pharmacist will verify it via a quick video call.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              {[
                { id: 'description', label: 'Description' },
                { id: 'ingredients', label: 'Active Ingredients' },
                { id: 'warnings', label: 'Warnings & Side Effects' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition border-b-2 ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'description' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">About {medicine.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{medicine.description}</p>
                </div>

                {medicine.uses && medicine.uses.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Uses</h3>
                    <ul className="space-y-2">
                      {medicine.uses.map((use, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                          <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          {use}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Storage</h3>
                  <p className="text-gray-600 dark:text-gray-400">{medicine.storageInstructions}</p>
                </div>
              </div>
            )}

            {activeTab === 'ingredients' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Active Ingredients</h3>
                <div className="flex flex-wrap gap-2">
                  {medicine.activeIngredients && medicine.activeIngredients.map((ingredient, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                    >
                      {ingredient}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'warnings' && (
              <div className="space-y-6">
                {medicine.warnings && medicine.warnings.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Warnings</h3>
                    <ul className="space-y-2">
                      {medicine.warnings.map((warning, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                          <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {medicine.sideEffects && medicine.sideEffects.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Possible Side Effects</h3>
                    <ul className="space-y-2">
                      {medicine.sideEffects.map((effect, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                          <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          {effect}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}