import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, ShoppingCart, Users, Package,
  Download, RefreshCw, ArrowUpRight, ArrowDownRight,
  BarChart3, PieChart, Activity
} from 'lucide-react';
import api from '../../services/api';

interface AnalyticsData {
  revenue: {
    total: number;
    change: number;
    data: { date: string; amount: number }[];
  };
  orders: {
    total: number;
    change: number;
    data: { date: string; count: number }[];
  };
  users: {
    total: number;
    change: number;
    newThisPeriod: number;
  };
  topMedicines: {
    id: string;
    name: string;
    sold: number;
    revenue: number;
  }[];
  ordersByStatus: {
    status: string;
    count: number;
    percentage: number;
  }[];
  revenueByCategory: {
    category: string;
    revenue: number;
    percentage: number;
  }[];
  deliveryMetrics: {
    avgDeliveryTime: number;
    onTimeRate: number;
    completionRate: number;
  };
}

type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'year';

interface AuditActivity {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  role?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [refreshing, setRefreshing] = useState(false);
  const [exportError, setExportError] = useState('');
  const [auditActivities, setAuditActivities] = useState<AuditActivity[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await api.get(`/admin/analytics?range=${dateRange}`).catch(() => null);
      setData(response?.data?.data || null);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const fetchAuditLog = useCallback(async () => {
    try {
      setAuditLoading(true);
      const res = await api.get('/admin/activity-log?limit=40');
      setAuditActivities(res.data?.data?.activities || []);
    } catch {
      setAuditActivities([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateStr: string, range: DateRange) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (range === 'today') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleExport = async () => {
    try {
      setExportError('');
      const response = await api.get(`/admin/analytics/export?range=${dateRange}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
      setExportError('Failed to export analytics');
    }
  };

  const getMaxValue = (arr: number[]) => Math.max(...arr, 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const revenueMax = getMaxValue(data.revenue.data.map(d => d.amount));
  const ordersMax = getMaxValue(data.orders.data.map(d => d.count));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Track your business performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-gray-200 rounded-lg p-1">
            {(['today', 'week', 'month', 'quarter', 'year'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {exportError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {exportError}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <span className={`inline-flex items-center gap-1 text-sm font-medium ${data.revenue.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.revenue.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(data.revenue.change).toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.total)}</p>
          <p className="text-sm text-gray-500">Total Revenue</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <span className={`inline-flex items-center gap-1 text-sm font-medium ${data.orders.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.orders.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(data.orders.change).toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(data.orders.total)}</p>
          <p className="text-sm text-gray-500">Total Orders</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <span className={`inline-flex items-center gap-1 text-sm font-medium ${data.users.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.users.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(data.users.change).toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(data.users.total)}</p>
          <p className="text-sm text-gray-500">Total Users</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
              <ArrowUpRight className="w-4 h-4" />
              {data.deliveryMetrics.onTimeRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.deliveryMetrics.avgDeliveryTime}m</p>
          <p className="text-sm text-gray-500">Avg Delivery Time</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
              <p className="text-sm text-gray-500">{formatCurrency(data.revenue.total)} total</p>
            </div>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-48 flex items-end gap-1">
            {data.revenue.data.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-emerald-500 rounded-t hover:bg-emerald-600 transition-colors cursor-pointer"
                  style={{ height: `${(d.amount / revenueMax) * 100}%`, minHeight: '4px' }}
                  title={`${formatDate(d.date, dateRange)}: ${formatCurrency(d.amount)}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{formatDate(data.revenue.data[0]?.date || '', dateRange)}</span>
            <span>{formatDate(data.revenue.data[data.revenue.data.length - 1]?.date || '', dateRange)}</span>
          </div>
        </div>

        {/* Orders Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Orders Trend</h3>
              <p className="text-sm text-gray-500">{formatNumber(data.orders.total)} total</p>
            </div>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-48 flex items-end gap-1">
            {data.orders.data.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                  style={{ height: `${(d.count / ordersMax) * 100}%`, minHeight: '4px' }}
                  title={`${formatDate(d.date, dateRange)}: ${d.count} orders`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{formatDate(data.orders.data[0]?.date || '', dateRange)}</span>
            <span>{formatDate(data.orders.data[data.orders.data.length - 1]?.date || '', dateRange)}</span>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Medicines */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Selling Medicines</h3>
            <Package className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {data.topMedicines.map((med, i) => (
              <div key={med.id} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-gray-100 text-gray-700' :
                  i === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{med.name}</p>
                  <p className="text-xs text-gray-500">{med.sold} units sold</p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">{formatCurrency(med.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Orders by Status</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {data.ordersByStatus.map((status) => {
              const colors: Record<string, string> = {
                'Delivered': 'bg-green-500',
                'In Transit': 'bg-blue-500',
                'Processing': 'bg-purple-500',
                'Pending': 'bg-yellow-500',
                'Cancelled': 'bg-red-500',
              };
              return (
                <div key={status.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{status.status}</span>
                    <span className="text-sm font-medium text-gray-900">{status.count}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[status.status] || 'bg-gray-400'} rounded-full`}
                      style={{ width: `${status.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue by Category */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Revenue by Category</h3>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {data.revenueByCategory.map((cat) => {
              const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-gray-400'];
              const colorIndex = data.revenueByCategory.indexOf(cat) % colors.length;
              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{cat.category}</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(cat.revenue)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[colorIndex]} rounded-full`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delivery Metrics */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Performance</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-3 relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="48" cy="48" r="40" fill="none" stroke="#10b981" strokeWidth="8"
                  strokeDasharray={`${data.deliveryMetrics.completionRate * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-900">{data.deliveryMetrics.completionRate.toFixed(0)}%</span>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-900">Completion Rate</p>
            <p className="text-xs text-gray-500">Orders delivered successfully</p>
          </div>

          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-3 relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="48" cy="48" r="40" fill="none" stroke="#3b82f6" strokeWidth="8"
                  strokeDasharray={`${data.deliveryMetrics.onTimeRate * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-900">{data.deliveryMetrics.onTimeRate.toFixed(0)}%</span>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-900">On-Time Rate</p>
            <p className="text-xs text-gray-500">Delivered within estimate</p>
          </div>

          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-3 flex items-center justify-center bg-orange-50 rounded-full">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{data.deliveryMetrics.avgDeliveryTime}</p>
                <p className="text-xs text-orange-500">mins</p>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-900">Avg Delivery Time</p>
            <p className="text-xs text-gray-500">From dispatch to delivery</p>
          </div>
        </div>
      </div>

      {/* MongoDB audit trail */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              Recent activity
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">Audit log stored in MongoDB (logins, orders, prescriptions)</p>
          </div>
          <button
            type="button"
            onClick={() => fetchAuditLog()}
            disabled={auditLoading}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        {auditLoading && auditActivities.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Loading activity…</p>
        ) : auditActivities.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No events yet. Place an order or sign in to populate the log.</p>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-gray-100">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600 sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditActivities.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-900">{row.action}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.entityType}
                      {row.entityId ? <span className="text-gray-400 text-xs block truncate max-w-[120px]" title={row.entityId}>{row.entityId.slice(0, 8)}…</span> : null}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{row.role || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px] truncate" title={JSON.stringify(row.metadata || {})}>
                      {row.metadata && Object.keys(row.metadata).length > 0
                        ? JSON.stringify(row.metadata)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}