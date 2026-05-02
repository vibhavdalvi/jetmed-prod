import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface Stats {
  pendingCount: number;
  reviewedToday: number;
  approvedToday: number;
  rejectedToday: number;
}

interface QueueOrder {
  id: string;
  orderNumber: string;
  status: string;
  urgencyLevel: string;
  totalAmount: number;
  createdAt: string;
  prescriptionImages?: string[];
  prescriptionIds?: string[];
  symptomsDescription?: string;
  user?: {
    profile?: {
      firstName: string;
      lastName: string;
    };
  };
}

export default function PharmacistDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [queueOrders, setQueueOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const [statsRes, queueRes] = await Promise.all([
        api.get('/pharmacist/stats'),
        api.get('/pharmacist/queue?limit=10'),
      ]);

      setStats(statsRes.data.data);
      const rawOrders = queueRes.data.data.orders || [];
      setQueueOrders(
        rawOrders.map((o: any) => ({
          ...o,
          prescriptionImages: Array.isArray(o.prescriptionImages) ? o.prescriptionImages : [],
          prescriptionIds: Array.isArray(o.prescriptionIds) ? o.prescriptionIds : [],
        }))
      );
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

  const getUrgencyBadge = (urgency: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      emergency: { bg: 'bg-red-100', text: 'text-red-700' },
      urgent: { bg: 'bg-orange-100', text: 'text-orange-700' },
      routine: { bg: 'bg-gray-100', text: 'text-gray-700' },
    };
    return config[urgency] || config.routine;
  };

  const getTimeAgo = (dateStr: string) => {
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
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pharmacist Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Review prescriptions and approve orders</p>
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Review</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.pendingCount || 0}
                </p>
              </div>
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <ClockIcon className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Reviewed Today</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.reviewedToday || 0}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ClipboardDocumentListIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved Today</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.approvedToday || 0}
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rejected Today</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.rejectedToday || 0}
                </p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Order Queue */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Orders Pending Review</h2>
            <Link
              to="/pharmacist/queue"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View All <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {queueOrders.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-500">No orders pending review</p>
              </div>
            ) : (
              queueOrders.map((order) => {
                const urgencyBadge = getUrgencyBadge(order.urgencyLevel);
                const total = Number(order.totalAmount ?? 0);
                const rxCount = order.prescriptionImages?.length || order.prescriptionIds?.length || 0;
                const previewUrls = (order.prescriptionImages || []).slice(0, 3);
                return (
                  <Link
                    key={order.id}
                    to={`/pharmacist/review/${order.id}`}
                    className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {order.orderNumber}
                          </p>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${urgencyBadge.bg} ${urgencyBadge.text}`}>
                            {order.urgencyLevel}
                          </span>
                          {rxCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">
                              <DocumentTextIcon className="h-3.5 w-3.5" />
                              {rxCount} file{rxCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {order.user?.profile?.firstName} {order.user?.profile?.lastName}
                        </p>
                        {order.symptomsDescription && (
                          <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                            {order.symptomsDescription}
                          </p>
                        )}
                        {previewUrls.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {previewUrls.map((url: string, i: number) => {
                              const path = url.split('?')[0].toLowerCase();
                              const isPdf = path.endsWith('.pdf');
                              return (
                                <a
                                  key={`${order.id}-rx-${i}`}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700"
                                >
                                  {isPdf ? (
                                    <DocumentTextIcon className="h-7 w-7 text-primary-600" />
                                  ) : (
                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                  )}
                                </a>
                              );
                            })}
                            <span className="text-xs text-gray-500 dark:text-gray-400">Tap to open in new tab</span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="font-medium text-gray-900 dark:text-white">
                          ${total.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">{getTimeAgo(order.createdAt)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}