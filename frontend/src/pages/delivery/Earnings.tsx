import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, Download, Package, Award, ArrowUpRight, Wallet, CreditCard
} from 'lucide-react';
import api from '../../services/api';

interface EarningRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  baseAmount: number;
  distanceBonus: number;
  timeBonus: number;
  surgeBonus: number;
  tipAmount: number;
  totalAmount: number;
  isPaid: boolean;
  paidAt?: string;
  createdAt: string;
}

interface EarningsStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  pendingPayout: number;
  lastPayout: number;
  lastPayoutDate?: string;
  totalDeliveries: number;
  averagePerDelivery: number;
  averageRating: number;
}

interface PayoutMethod {
  id: string;
  type: 'bank_account' | 'paypal' | 'venmo';
  name: string;
  last4: string;
  isDefault: boolean;
}

export default function Earnings() {
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState('');
  const [payoutError, setPayoutError] = useState('');

  const fetchEarningsData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, earningsRes, methodsRes] = await Promise.all([
        api.get('/delivery/earnings/stats'),
        api.get(`/delivery/earnings?period=${period}`),
        api.get('/delivery/payout-methods'),
      ]);

      setStats(statsRes.data?.data?.stats || null);
      setEarnings(earningsRes.data?.data?.earnings || []);
      setPayoutMethods(methodsRes.data?.data?.methods || []);
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
      setStats(null);
      setEarnings([]);
      setPayoutMethods([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchEarningsData();
  }, [fetchEarningsData]);

  const requestPayout = async () => {
    try {
      setRequestingPayout(true);
      setPayoutMessage('');
      setPayoutError('');
      await api.post('/delivery/payout/request');
      setShowPayoutModal(false);
      fetchEarningsData();
      setPayoutMessage('Payout request submitted. Funds will be transferred within 1-2 business days.');
    } catch (error) {
      console.error('Payout request failed:', error);
      setPayoutError('Failed to request payout. Please try again.');
    } finally {
      setRequestingPayout(false);
    }
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const getEarningBreakdown = (earning: EarningRecord) => {
    const parts = [];
    parts.push({ label: 'Base', amount: earning.baseAmount });
    if (earning.distanceBonus > 0) parts.push({ label: 'Distance', amount: earning.distanceBonus });
    if (earning.timeBonus > 0) parts.push({ label: 'Time Bonus', amount: earning.timeBonus });
    if (earning.surgeBonus > 0) parts.push({ label: 'Surge', amount: earning.surgeBonus });
    if (earning.tipAmount > 0) parts.push({ label: 'Tip', amount: earning.tipAmount });
    return parts;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header with Total Earnings */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white px-4 pt-6 pb-20">
        <h1 className="text-xl font-bold mb-6">My Earnings</h1>

        <div className="text-center">
          <p className="text-emerald-200 text-sm mb-1">This {period === 'today' ? 'Day' : period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'Time'}</p>
          <h2 className="text-4xl font-bold">
            {formatCurrency(
              period === 'today' ? stats?.today || 0 :
              period === 'week' ? stats?.thisWeek || 0 :
              period === 'month' ? stats?.thisMonth || 0 :
              stats?.allTime || 0
            )}
          </h2>
        </div>

        {/* Period Selector */}
        <div className="flex justify-center gap-2 mt-6">
          {(['today', 'week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                period === p ? 'bg-white text-emerald-700' : 'bg-emerald-500/30 text-white'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 -mt-12">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Package className="w-4 h-4" />
              <span className="text-sm">Deliveries</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalDeliveries || 0}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Avg/Delivery</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.averagePerDelivery || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Per order</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Award className="w-4 h-4" />
              <span className="text-sm">Rating</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.averageRating?.toFixed(1) || '5.0'}</p>
            <p className="text-xs text-gray-500 mt-1">⭐ Average</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Wallet className="w-4 h-4" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats?.pendingPayout || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Available</p>
          </div>
        </div>
      </div>

      {/* Payout Section */}
      <div className="px-4 mt-6">
        {payoutMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {payoutMessage}
          </div>
        )}
        {payoutError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {payoutError}
          </div>
        )}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Quick Payout</h3>
            <span className="text-emerald-600 font-bold">{formatCurrency(stats?.pendingPayout || 0)}</span>
          </div>

          {payoutMethods.length > 0 ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-4">
              <CreditCard className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{payoutMethods[0].name}</p>
                <p className="text-sm text-gray-500">•••• {payoutMethods[0].last4}</p>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Default</span>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-4">No payout method added yet.</p>
          )}

          <button
            onClick={() => setShowPayoutModal(true)}
            disabled={(stats?.pendingPayout || 0) < 25}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <DollarSign className="w-5 h-5" />
            Request Payout
          </button>
          {(stats?.pendingPayout || 0) < 25 && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Minimum payout amount is $25.00
            </p>
          )}

          {stats?.lastPayoutDate && (
            <p className="text-xs text-gray-500 text-center mt-3">
              Last payout: {formatCurrency(stats.lastPayout)} on {new Date(stats.lastPayoutDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Earnings History */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Earnings History</h3>
          <button className="text-emerald-600 text-sm font-medium flex items-center gap-1">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {earnings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="font-medium text-gray-900 mb-2">No earnings yet</h4>
            <p className="text-sm text-gray-500">Complete your first delivery to start earning!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {earnings.map((earning) => (
              <div key={earning.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        earning.isPaid ? 'bg-gray-100' : 'bg-emerald-100'
                      }`}>
                        <Package className={`w-5 h-5 ${earning.isPaid ? 'text-gray-500' : 'text-emerald-600'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Order #{earning.orderNumber}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(earning.createdAt).toLocaleDateString()} at{' '}
                          {new Date(earning.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCurrency(earning.totalAmount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        earning.isPaid ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {earning.isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Earnings Breakdown */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {getEarningBreakdown(earning).map((part, idx) => (
                        <span key={idx} className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-600">
                          {part.label}: {formatCurrency(part.amount)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Earnings Tips */}
      <div className="px-4 mt-6 mb-8">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
          <h4 className="font-semibold text-amber-900 mb-2">💡 Tips to Earn More</h4>
          <ul className="space-y-2 text-sm text-amber-800">
            <li className="flex items-start gap-2">
              <ArrowUpRight className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>Deliver during peak hours (11am-2pm, 6pm-9pm) for surge bonuses</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowUpRight className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>Maintain high ratings to get priority order assignments</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowUpRight className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>Complete express deliveries quickly for time bonuses</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Request Payout</h2>
            <p className="text-gray-600 mb-6">
              Transfer your earnings to your connected account.
            </p>

            <div className="bg-emerald-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-emerald-600 mb-1">Amount to transfer</p>
              <p className="text-3xl font-bold text-emerald-700">{formatCurrency(stats?.pendingPayout || 0)}</p>
            </div>

            {payoutMethods.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-6">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{payoutMethods[0].name}</p>
                  <p className="text-sm text-gray-500">•••• {payoutMethods[0].last4}</p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 mb-6">
              Funds typically arrive within 1-2 business days. A small processing fee may apply.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPayoutModal(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={requestPayout}
                disabled={requestingPayout}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold disabled:opacity-50"
              >
                {requestingPayout ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
