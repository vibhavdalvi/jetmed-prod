import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CubeIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface Stats {
  pendingOrders: number;
  packingOrders: number;
  packedOrders: number;
  lowStockItems: number;
  expiringItems: number;
}

interface PendingOrder {
  id: string;
  orderNumber: string;
  status: string;
  urgencyLevel: string;
  totalAmount: number;
  reviewedAt: string;
  user?: {
    profile?: {
      firstName: string;
      lastName: string;
    };
  };
  orderItems?: Array<{
    quantity: number;
    medicine?: {
      name: string;
    };
  }>;
}

export default function WarehouseDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const [statsRes, ordersRes] = await Promise.all([
        api.get('/warehouse/stats'),
        api.get('/warehouse/orders/pending?limit=10'),
      ]);

      setStats(statsRes.data.data);
      setPendingOrders(ordersRes.data.data.orders || []);
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const startPacking = async (orderId: string) => {
    try {
      setActionError('');
      await api.post(`/warehouse/orders/${orderId}/start-packing`);
      fetchData(true);
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to start packing');
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      emergency: { bg: 'bg-red-100', text: 'text-red-700' },
      urgent: { bg: 'bg-orange-100', text: 'text-orange-700' },
      routine: { bg: 'bg-gray-100', text: 'text-gray-700' },
    };
    return config[urgency] || config.routine;
  };

  const getTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${diffHours}h ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Warehouse Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Pack and manage orders</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {actionError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.pendingOrders || 0}
                </p>
              </div>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <ClockIcon className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Packing</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.packingOrders || 0}
                </p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <CubeIcon className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Packed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.packedOrders || 0}
                </p>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.lowStockItems || 0}
                </p>
              </div>
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Expiring</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.expiringItems || 0}
                </p>
              </div>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <ClockIcon className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Orders to Pack */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Orders Ready to Pack</h2>
            <Link
              to="/warehouse/pack"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View All <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {pendingOrders.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-500">No orders pending to pack</p>
              </div>
            ) : (
              pendingOrders.map((order) => {
                const urgencyBadge = getUrgencyBadge(order.urgencyLevel);
                const itemCount = order.orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                return (
                  <div key={order.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-gray-900 dark:text-white">{order.orderNumber}</p>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${urgencyBadge.bg} ${urgencyBadge.text}`}>
                            {order.urgencyLevel}
                          </span>
                        </div>
                        <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                          {order.user?.profile?.firstName} {order.user?.profile?.lastName}
                        </p>
                        <p className="truncate text-sm text-gray-500 mt-1">
                          {itemCount} items • Approved {getTimeAgo(order.reviewedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => startPacking(order.id)}
                        className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition"
                      >
                        Start Packing
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/warehouse/inventory"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition"
          >
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <ClipboardDocumentCheckIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Manage Inventory</p>
              <p className="text-sm text-gray-500">View stock levels and add inventory</p>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-gray-400 ml-auto" />
          </Link>

          <Link
            to="/warehouse/pack"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition"
          >
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CubeIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Pack Orders</p>
              <p className="text-sm text-gray-500">View and pack pending orders</p>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-gray-400 ml-auto" />
          </Link>
        </div>
      </div>
    </div>
  );
}