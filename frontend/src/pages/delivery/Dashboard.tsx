import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TruckIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface Stats {
  activeDeliveries: number;
  completedToday: number;
  totalCompleted: number;
}

interface AvailableOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  deliveryFee: number;
  deliveryAddress?: {
    streetAddress: string;
    city: string;
    state: string;
  };
  warehouse?: {
    name: string;
    address: string;
    city: string;
  };
}

interface MyOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  deliveryStartedAt: string;
  user?: {
    profile?: {
      firstName: string;
      lastName: string;
    };
  };
  deliveryAddress?: {
    streetAddress: string;
    city: string;
  };
}

export default function DeliveryDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [myOrders, setMyOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      setActionError('');

      const [statsRes, availableRes, myOrdersRes] = await Promise.all([
        api.get('/delivery/stats'),
        api.get('/delivery/available?limit=5'),
        api.get('/delivery/my-orders?status=out_for_delivery'),
      ]);

      setStats(statsRes.data.data);
      setAvailableOrders(availableRes.data.data.orders || []);
      setMyOrders(myOrdersRes.data.data.orders || []);
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

  const acceptOrder = async (orderId: string) => {
    try {
      setActionError('');
      await api.post(`/delivery/accept/${orderId}`);
      fetchData(true);
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to accept order');
    }
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Delivery Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your deliveries</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Deliveries</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.activeDeliveries || 0}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TruckIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed Today</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.completedToday || 0}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Completed</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.totalCompleted || 0}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Active Deliveries */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Active Deliveries</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {myOrders.length === 0 ? (
                <div className="p-8 text-center">
                  <TruckIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No active deliveries</p>
                </div>
              ) : (
                myOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/delivery/active/${order.id}`}
                    className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900 dark:text-white">{order.orderNumber}</p>
                        <p className="truncate text-sm text-gray-500">
                          {order.user?.profile?.firstName} {order.user?.profile?.lastName}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                          <MapPinIcon className="w-4 h-4" />
                          <span className="truncate">
                            {order.deliveryAddress?.streetAddress}, {order.deliveryAddress?.city}
                          </span>
                        </div>
                      </div>
                      <ArrowRightIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Available Orders */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Available for Pickup</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {availableOrders.length === 0 ? (
                <div className="p-8 text-center">
                  <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No orders available</p>
                </div>
              ) : (
                availableOrders.map((order) => (
                  <div key={order.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900 dark:text-white">{order.orderNumber}</p>
                        <p className="truncate text-sm text-gray-500">
                          From: {order.warehouse?.name}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                          <MapPinIcon className="w-4 h-4" />
                          <span className="truncate">
                            {order.deliveryAddress?.city}, {order.deliveryAddress?.state}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          ${order.deliveryFee?.toFixed(2) || '5.99'}
                        </p>
                        <button
                          onClick={() => acceptOrder(order.id)}
                          className="mt-2 px-3 py-1 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/delivery/earnings"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition"
          >
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">View Earnings</p>
              <p className="text-sm text-gray-500">Check your earnings and payouts</p>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-gray-400 ml-auto" />
          </Link>
        </div>
      </div>
    </div>
  );
}