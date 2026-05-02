import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  ShieldCheckIcon,
  TruckIcon,
  StarIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import api from '../../services/api';

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  slug: string;
  images: string[];
  dosageOptions: { price: number }[];
  prescriptionRequirement: string;
  rating?: number;
}

const features = [
  {
    icon: ClockIcon,
    title: 'Fast Delivery',
    description: 'Same-day and express delivery windows designed for urgent health needs.',
    color: 'bg-blue-500',
  },
  {
    icon: TruckIcon,
    title: 'Live Tracking',
    description: 'Track every order from pharmacist approval to doorstep delivery.',
    color: 'bg-teal-500',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Prescription Safety',
    description: 'Licensed pharmacists verify all prescription orders before fulfillment.',
    color: 'bg-purple-500',
  },
];

const howItWorks = [
  { step: 1, title: 'Browse & Add', description: 'Search for medicines and add them to your cart' },
  { step: 2, title: 'Upload Prescription', description: 'Upload your prescription for Rx medicines' },
  { step: 3, title: 'Quick Verification', description: 'Our pharmacist verifies your prescription in minutes' },
  { step: 4, title: 'Fast Delivery', description: 'Get your medicines delivered to your doorstep' },
];

// Placeholder image for medicines without images
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop';

export default function Home() {
  const [featuredMedicines, setFeaturedMedicines] = useState<Medicine[]>([]);
  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        const response = await api.get('/medicines?limit=8&sort=popular');
        setFeaturedMedicines(response.data.data?.medicines || []);
        setCatalogCount(response.data.data?.total || null);
      } catch (error) {
        console.error('Failed to fetch medicines:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMedicines();
  }, []);

  // Get medicine image with fallback
  const getMedicineImage = (medicine: Medicine) => {
    if (medicine.images && medicine.images.length > 0 && medicine.images[0]) {
      return medicine.images[0];
    }
    return PLACEHOLDER_IMAGE;
  };

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-72 h-72 bg-secondary-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                Available 24/7 • Delivering Now
              </span>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-gray-900 dark:text-white leading-tight mb-6">
                Medicine at the{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600">Speed of Need</span>
              </h1>

              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-lg">
                Get your prescriptions delivered in under an hour, any time of day or night. 
                Licensed pharmacists verify every order via secure video call.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/medicines" className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium group">
                  Browse Medicines
                  <ArrowRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/register" className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition font-medium">
                  Create Account
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  HIPAA Compliant
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  Licensed Pharmacy
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative w-full h-[500px]">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute top-10 left-10 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl overflow-hidden">
                      <img 
                        src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=100&h=100&fit=crop" 
                        alt="Medicine"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {featuredMedicines[0]?.name || 'Verified medicines'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {featuredMedicines[0]?.dosageOptions?.[0]?.price
                          ? `$${featuredMedicines[0].dosageOptions[0].price.toFixed(2)}`
                          : 'Fresh catalog updates'}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute top-40 right-0 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-2xl">🏥</div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Prescription Check</p>
                      <p className="text-sm text-green-500">Licensed pharmacist review</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, -15, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="absolute bottom-20 left-20 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">🚀</div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Live Delivery Tracking</p>
                      <p className="text-sm text-gray-500">Follow order updates in real time</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: catalogCount ? `${catalogCount.toLocaleString()}+` : 'Live', label: 'Medicines In Catalog' },
              { value: '24/7', label: 'Ordering Availability' },
              { value: '< 60 min', label: 'Express Delivery Window' },
              { value: 'Secure', label: 'Prescription Review Flow' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600">{stat.value}</p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-white mb-4">
              Why Choose JetMed?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              We're revolutionizing pharmacy delivery with technology and care
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-4`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">Get your medicines in 4 simple steps</p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative text-center"
              >
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary-500 to-secondary-500" />
                )}
                <div className="relative inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full text-white text-2xl font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Medicines */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl font-display font-bold text-gray-900 dark:text-white mb-2">Popular Medicines</h2>
              <p className="text-gray-600 dark:text-gray-300">Fast delivery on your everyday essentials</p>
            </div>
            <Link to="/medicines" className="hidden md:flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              View All <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
                  <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : featuredMedicines.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredMedicines.map((medicine, index) => (
                <motion.div
                  key={medicine.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/medicines/${medicine.slug}`} className="block bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition">
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
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">{medicine.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{medicine.genericName}</p>
                      </div>
                      {medicine.prescriptionRequirement === 'prescription_required' && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Rx</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-lg font-bold text-primary-600">
                        ${medicine.dosageOptions?.[0]?.price?.toFixed(2) || '0.00'}
                      </p>
                      {medicine.rating && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <StarIcon className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          {medicine.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No medicines available yet</p>
              <Link to="/medicines" className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 mt-4">Browse All</Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-secondary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">Need Medicine Right Now?</h2>
          <p className="text-xl text-white/80 mb-8">Order securely in minutes with prescription verification and live delivery updates.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/medicines" className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary-600 rounded-lg hover:bg-gray-100 font-medium">Order Online</Link>
            <Link to="/register" className="inline-flex items-center justify-center px-6 py-3 bg-white/20 text-white rounded-lg hover:bg-white/30 font-medium border border-white/30">Create Account</Link>
          </div>
        </div>
      </section>
    </div>
  );
}