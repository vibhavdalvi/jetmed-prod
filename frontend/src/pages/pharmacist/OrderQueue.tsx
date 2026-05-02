import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  EyeIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XMarkIcon,
  UserIcon,
  BeakerIcon,
  ShieldExclamationIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  quantity: number;
  requiresRx: boolean;
  isControlled: boolean;
}

interface PendingOrder {
  id: string;
  orderNumber: string;
  patientId: string; // Anonymous ID
  medicines: Medicine[];
  prescriptionImages: string[];
  prescriptionCount: number;
  priority: 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_review' | 'info_requested';
  waitTime: number; // minutes
  createdAt: string;
  assignedTo?: string;
  hasAllergies: boolean;
  allergies: string[];
  hasChronicConditions: boolean;
  chronicConditions: string[];
  hasDrugInteractions: boolean;
  potentialInteractions: string[];
  symptomsDescription?: string;
  previousOrders: number;
  isFirstOrder: boolean;
  deliveryType: 'express' | 'standard' | 'same_day' | 'scheduled';
}

interface QueueStats {
  total: number;
  urgent: number;
  high: number;
  normal: number;
  inReview: number;
  infoRequested: number;
  avgWaitTime: number;
}

const priorityConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', borderColor: 'border-red-300 dark:border-red-700' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', borderColor: 'border-orange-300 dark:border-orange-700' },
  normal: { label: 'Normal', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-700', borderColor: 'border-gray-200 dark:border-gray-600' },
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  in_review: { label: 'In Review', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  info_requested: { label: 'Info Requested', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
};

const deliveryTypeLabels: Record<string, string> = {
  express: 'Express (30-60min)',
  standard: 'Standard (1-2hr)',
  same_day: 'Same Day',
  scheduled: 'Scheduled',
};

export default function PharmacistOrderQueue() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PendingOrder[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('wait_time');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const mapApiOrderToQueueOrder = (order: any): PendingOrder => {
    const orderItems = order?.orderItems || order?.items || [];
    const medicines: Medicine[] = orderItems.map((item: any, index: number) => {
      const dosageOption =
        item?.medicine?.dosageOptions?.find?.((d: any) => d.id === item.dosageOptionId) ||
        item?.medicine?.dosageOptions?.[0];
      return {
        id: item?.id || `medicine-${index}`,
        name: item?.medicine?.name || 'Unknown',
        genericName: item?.medicine?.genericName || '',
        dosage: dosageOption ? `${dosageOption.strength}${dosageOption.unit}` : '',
        quantity: item?.quantity || 0,
        requiresRx: !!item?.prescriptionRequired,
        isControlled: item?.medicine?.prescriptionRequirement === 'controlled_substance',
      };
    });

    const waitTime = Math.max(0, Math.floor((Date.now() - new Date(order?.createdAt || Date.now()).getTime()) / 60000));
    const priority: PendingOrder['priority'] =
      order?.urgencyLevel === 'emergency' ? 'urgent' : order?.urgencyLevel === 'urgent' ? 'high' : 'normal';

    return {
      id: order?.id || '',
      orderNumber: order?.orderNumber || 'Unknown',
      patientId: order?.userId ? `Patient #${String(order.userId).slice(0, 6).toUpperCase()}` : 'Patient',
      medicines,
      prescriptionImages: Array.isArray(order?.prescriptionImages) ? order.prescriptionImages : [],
      prescriptionCount: order?.prescriptionIds?.length || 0,
      priority,
      status: order?.status === 'placed' ? 'pending' : order?.status === 'pending_review' ? 'in_review' : 'pending',
      waitTime,
      createdAt: order?.createdAt || new Date().toISOString(),
      assignedTo: order?.reviewedBy,
      hasAllergies: false,
      allergies: [],
      hasChronicConditions: false,
      chronicConditions: [],
      hasDrugInteractions: false,
      potentialInteractions: [],
      symptomsDescription: order?.symptomsDescription || undefined,
      previousOrders: 0,
      isFirstOrder: false,
      deliveryType: order?.deliveryType || 'standard',
    };
  };

  // Fetch queue data
  useEffect(() => {
    const fetchQueueData = async () => {
      try {
        const [ordersRes, statsRes] = await Promise.all([
          api.get('/pharmacist/queue'),
          api.get('/pharmacist/queue/stats'),
        ]);
        const apiOrders = ordersRes.data?.data?.orders || [];
        const mappedOrders = apiOrders.map(mapApiOrderToQueueOrder);
        setOrders(mappedOrders);
        const statsData = statsRes.data?.data;
        setStats({
          total: statsData?.total || mappedOrders.length,
          urgent: statsData?.urgent || 0,
          high: statsData?.high || 0,
          normal: statsData?.normal || 0,
          inReview: statsData?.inReview || 0,
          infoRequested: statsData?.infoRequested || 0,
          avgWaitTime: statsData?.avgWaitTime || 0,
        });
      } catch (error) {
        console.error('Failed to fetch queue:', error);
        setOrders([]);
        setStats({
          total: 0,
          urgent: 0,
          high: 0,
          normal: 0,
          inReview: 0,
          infoRequested: 0,
          avgWaitTime: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchQueueData();

    // Refresh every 15 seconds
    const interval = setInterval(fetchQueueData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filter and sort orders
  useEffect(() => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(query) ||
          order.patientId.toLowerCase().includes(query) ||
          order.medicines.some((m) => m.name.toLowerCase().includes(query))
      );
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((order) => order.priority === priorityFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Sort
    switch (sortBy) {
      case 'wait_time':
        filtered.sort((a, b) => b.waitTime - a.waitTime);
        break;
      case 'priority':
        const priorityOrder = { urgent: 0, high: 1, normal: 2 };
        filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
    }

    setFilteredOrders(filtered);
  }, [orders, searchQuery, priorityFilter, statusFilter, sortBy]);

  // Start reviewing an order
  const startReview = async (orderId: string) => {
    navigate(`/pharmacist/review/${orderId}`);
  };

  // Start reviewing next order (auto-assignment)
  const startNextReview = async () => {
    const nextOrder = filteredOrders.find((o) => o.status === 'pending');
    if (nextOrder) {
      await startReview(nextOrder.id);
    }
  };

  // Toggle order selection
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Select all visible orders
  const selectAllOrders = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map((o) => o.id));
    }
  };

  // Refresh queue
  const refreshQueue = async () => {
    setIsLoading(true);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        api.get('/pharmacist/queue'),
        api.get('/pharmacist/queue/stats'),
      ]);
      const mappedOrders = (ordersRes.data?.data?.orders || []).map(mapApiOrderToQueueOrder);
      setOrders(mappedOrders);
      const statsData = statsRes.data?.data;
      setStats({
        total: statsData?.total || mappedOrders.length,
        urgent: statsData?.urgent || 0,
        high: statsData?.high || 0,
        normal: statsData?.normal || 0,
        inReview: statsData?.inReview || 0,
        infoRequested: statsData?.infoRequested || 0,
        avgWaitTime: statsData?.avgWaitTime || 0,
      });
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format wait time
  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Order Queue</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {stats?.total} orders pending review
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button onClick={refreshQueue} className="btn-ghost flex items-center gap-2">
            <ArrowPathIcon className="w-5 h-5" />
            Refresh
          </button>
          <button onClick={startNextReview} className="btn-primary flex items-center gap-2">
            Start Next Review
            <ArrowRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total Pending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total}</p>
            </div>
            <ClockIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="card p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Urgent</p>
              <p className="text-2xl font-bold text-red-600">{stats?.urgent}</p>
            </div>
            <ExclamationTriangleIcon className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div className="card p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">High Priority</p>
              <p className="text-2xl font-bold text-orange-600">{stats?.high}</p>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Info Requested</p>
              <p className="text-2xl font-bold text-purple-600">{stats?.infoRequested}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Avg Wait Time</p>
              <p className="text-2xl font-bold text-primary-600">{stats?.avgWaitTime}m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order number, patient ID, or medicine..."
              className="input pl-10 w-full"
            />
          </div>

          {/* Filter Toggle (Mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden btn-outline flex items-center justify-center gap-2"
          >
            <FunnelIcon className="w-5 h-5" />
            Filters
          </button>

          {/* Filters (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_review">In Review</option>
              <option value="info_requested">Info Requested</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input"
            >
              <option value="wait_time">Longest Wait</option>
              <option value="priority">Priority</option>
              <option value="oldest">Oldest First</option>
              <option value="newest">Newest First</option>
            </select>
          </div>
        </div>

        {/* Mobile Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="input"
                >
                  <option value="all">All Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="info_requested">Info Requested</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="input"
                >
                  <option value="wait_time">Wait Time</option>
                  <option value="priority">Priority</option>
                  <option value="oldest">Oldest</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <div className="card p-4 mb-4 bg-primary-50 dark:bg-primary-900/20 flex items-center justify-between">
          <p className="font-medium text-primary-700 dark:text-primary-300">
            {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedOrders([])}
              className="btn-ghost text-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Queue is empty!</h3>
          <p className="text-gray-500">
            {searchQuery || priorityFilter !== 'all' || statusFilter !== 'all'
              ? 'No orders match your filters'
              : 'All orders have been reviewed'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const priorityCfg = priorityConfig[order.priority];
            const statusCfg = statusConfig[order.status];
            const hasControlled = order.medicines.some((m) => m.isControlled);
            const isSelected = selectedOrders.includes(order.id);

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`card overflow-hidden border-l-4 ${priorityCfg.borderColor} ${
                  isSelected ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <div className="p-4 md:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Checkbox */}
                    <div className="hidden lg:block">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="w-5 h-5 rounded text-primary-600"
                      />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="font-bold text-lg text-gray-900 dark:text-white">
                          {order.orderNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.bgColor} ${priorityCfg.color}`}>
                          {priorityCfg.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        {hasControlled && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <ShieldExclamationIcon className="w-3 h-3" />
                            Controlled
                          </span>
                        )}
                        {order.isFirstOrder && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            First Order
                          </span>
                        )}
                      </div>

                      {/* Patient Info (Anonymous) */}
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <UserIcon className="w-4 h-4" />
                        <span>{order.patientId}</span>
                        <span>•</span>
                        <span>{order.previousOrders} previous orders</span>
                        <span>•</span>
                        <span>{deliveryTypeLabels[order.deliveryType]}</span>
                      </div>

                      {/* Medicines */}
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Medicines:</p>
                        <div className="flex flex-wrap gap-2">
                          {order.medicines.map((med) => (
                            <span
                              key={med.id}
                              className={`px-2 py-1 rounded-lg text-sm ${
                                med.requiresRx
                                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {med.name} {med.dosage} x{med.quantity}
                              {med.requiresRx && <span className="ml-1 text-xs">(Rx)</span>}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Alerts */}
                      {(order.hasAllergies || order.hasDrugInteractions || order.hasChronicConditions) && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {order.hasAllergies && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg text-xs text-red-700 dark:text-red-300">
                              <ExclamationTriangleIcon className="w-4 h-4" />
                              Allergies: {order.allergies.join(', ')}
                            </div>
                          )}
                          {order.hasDrugInteractions && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-xs text-orange-700 dark:text-orange-300">
                              <BeakerIcon className="w-4 h-4" />
                              Potential Interaction
                            </div>
                          )}
                          {order.hasChronicConditions && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                              Conditions: {order.chronicConditions.join(', ')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Symptoms Description */}
                      {order.symptomsDescription && (
                        <p className="text-sm text-gray-500 italic mb-3">
                          &quot;{order.symptomsDescription}&quot;
                        </p>
                      )}

                      {/* Prescription Preview */}
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">{order.prescriptionCount} prescription(s)</span>
                        {order.prescriptionImages.length > 0 && (
                          <button
                            onClick={() => setPreviewImage(order.prescriptionImages[0])}
                            className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                          >
                            <EyeIcon className="w-4 h-4" />
                            Preview
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right Side - Wait Time & Actions */}
                    <div className="flex lg:flex-col items-center lg:items-end gap-4">
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${
                          order.waitTime > 20 ? 'text-red-600' :
                          order.waitTime > 10 ? 'text-orange-600' :
                          'text-gray-600'
                        }`}>
                          {formatWaitTime(order.waitTime)}
                        </p>
                        <p className="text-xs text-gray-500">wait time</p>
                      </div>
                      <button
                        onClick={() => startReview(order.id)}
                        className="btn-primary flex items-center gap-2"
                      >
                        Review
                        <ArrowRightIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Prescription Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
                <div className="flex h-[70vh] items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700">
                  {previewImage && previewImage.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                    <iframe title="Prescription PDF" src={previewImage} className="h-full w-full rounded-lg bg-white" />
                  ) : previewImage ? (
                    <img src={previewImage} alt="Prescription" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="text-center">
                      <PhotoIcon className="mx-auto mb-4 h-24 w-24 text-gray-400" />
                      <p className="text-gray-500">No preview available</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
