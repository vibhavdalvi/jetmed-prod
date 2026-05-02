import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CubeIcon,
  ArrowPathIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface OrderItem {
  medicineId: string;
  medicineName: string;
  dosageOptionId: string;
  dosageInfo: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  subtotal: number;
  deliveryFee: number;
  items: OrderItem[];
  urgencyLevel: string;
  deliveryType: string;
  createdAt: string;
  deliveryAddress?: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending_payment: { label: 'Pending Payment', color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon },
  pending_review: { label: 'Pending Review', color: 'bg-blue-100 text-blue-700', icon: ClockIcon },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircleIcon },
  packing: { label: 'Packing', color: 'bg-purple-100 text-purple-700', icon: CubeIcon },
  packed: { label: 'Ready for Pickup', color: 'bg-indigo-100 text-indigo-700', icon: CubeIcon },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-orange-100 text-orange-700', icon: TruckIcon },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700', icon: XCircleIcon },
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });

      if (filter !== 'all') {
        params.append('status', filter);
      }

      const response = await api.get(`/orders?${params}`);
      
      // Handle the response safely
      const data = response.data?.data;
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
      setTotalPages(data?.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setError(err.response?.data?.message || 'Failed to load orders');
      setOrders([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: ClockIcon };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Filter orders by search
  const filteredOrders = orders.filter((order) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.items.some((item) => item.medicineName.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">Track and manage your orders</p>
        </div>
        <Link
          to="/medicines"
          className="btn-primary btn-sm"
        >
          <CubeIcon className="w-5 h-5" />
          Browse Medicines
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order number or medicine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Orders</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="packing">Packing</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            aria-label="Refresh orders"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading orders...</p>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-900 dark:text-white font-medium">{error}</p>
          <button
            onClick={fetchOrders}
            className="btn-primary btn-sm mt-4"
          >
            Try Again
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <ClipboardDocumentListIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No orders found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {filter !== 'all' ? 'Try changing your filter' : "You haven't placed any orders yet"}
          </p>
          <Link
            to="/medicines"
            className="btn-primary btn-sm"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusInfo = getStatusInfo(order.status);
            const StatusIcon = statusInfo.icon;

            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition overflow-hidden"
              >
                <div className="p-4 sm:p-6">
                  {/* Order Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        #{order.orderNumber}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusInfo.label}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>

                  {/* Order Items */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {order.items.length} item{order.items.length !== 1 ? 's' : ''}:
                      {' '}
                      {order.items.slice(0, 2).map((item, idx) => (
                        <span key={idx}>
                          {item.medicineName} x{item.quantity}
                          {idx < Math.min(order.items.length, 2) - 1 ? ', ' : ''}
                        </span>
                      ))}
                      {order.items.length > 2 && ` +${order.items.length - 2} more`}
                    </p>
                  </div>

                  {/* Order Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(order.totalAmount)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {order.deliveryType === 'express' ? '🚀 Express Delivery' : '📦 Standard Delivery'}
                      </p>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}