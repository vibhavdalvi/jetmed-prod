import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WalletIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  CreditCardIcon,
  BanknotesIcon,
  ReceiptRefundIcon,
  GiftIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  XMarkIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'refund' | 'cashback' | 'promo';
  amount: number;
  description: string;
  orderId?: string;
  orderNumber?: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  paymentMethod?: string;
}

interface WalletData {
  balance: number;
  pendingBalance: number;
  totalCredited: number;
  totalSpent: number;
  totalRefunds: number;
  totalCashback: number;
}

const transactionTypeConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  credit: { label: 'Added Money', icon: ArrowDownTrayIcon, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  debit: { label: 'Payment', icon: ArrowUpTrayIcon, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  refund: { label: 'Refund', icon: ReceiptRefundIcon, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  cashback: { label: 'Cashback', icon: GiftIcon, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  promo: { label: 'Promo Credit', icon: GiftIcon, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
};

const quickAmounts = [10, 25, 50, 100, 200, 500];

const mapWalletTransaction = (raw: any): Transaction => ({
  id: raw.id,
  type: raw.type,
  amount: Number(raw.amount || 0),
  description: raw.description || 'Wallet transaction',
  status: 'completed',
  createdAt: raw.createdAt || new Date().toISOString(),
});

export default function Wallet() {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [addAmount, setAddAmount] = useState<number | ''>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPayThreshold, setAutoPayThreshold] = useState(10);
  const [autoPayAmount, setAutoPayAmount] = useState(50);
  const [actionError, setActionError] = useState('');

  const fetchWalletData = async () => {
    try {
      const walletResponse = await api.get('/payments/wallet');
      const wallet = walletResponse.data.data?.wallet;
      const tx = (wallet?.transactions || []).map(mapWalletTransaction);
      const totalCredited = tx.filter((t: Transaction) => t.type === 'credit').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
      const totalSpent = tx.filter((t: Transaction) => t.type === 'debit').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
      const totalRefunds = tx.filter((t: Transaction) => t.type === 'refund').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
      const totalCashback = tx.filter((t: Transaction) => t.type === 'cashback').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
      setWalletData({
        balance: Number(wallet?.balance || 0),
        pendingBalance: 0,
        totalCredited,
        totalSpent,
        totalRefunds,
        totalCashback,
      });
      setTransactions(tx);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
      setActionError('Unable to load wallet data right now.');
      setWalletData({
        balance: 0,
        pendingBalance: 0,
        totalCredited: 0,
        totalSpent: 0,
        totalRefunds: 0,
        totalCashback: 0,
      });
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load wallet data
  useEffect(() => {
    fetchWalletData();
  }, []);

  // Filter transactions
  useEffect(() => {
    let filtered = [...transactions];

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((t) => t.type === typeFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case '3months':
          startDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter((t) => new Date(t.createdAt) >= startDate);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredTransactions(filtered);
  }, [transactions, typeFilter, dateFilter]);

  // Add money to wallet
  const handleAddMoney = async () => {
    if (!addAmount || addAmount <= 0) return;

    setIsProcessing(true);

    try {
      setActionError('');
      const response = await api.post('/payments/wallet/add', {
        amount: addAmount,
        paymentMethod: selectedPaymentMethod,
      });
      if (response.data.data?.newBalance !== undefined) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
      }
      await fetchWalletData();
      setShowAddMoneyModal(false);
      setAddAmount('');
    } catch (error) {
      console.error('Failed to add money:', error);
      setActionError('Failed to add wallet funds. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export transactions
  const exportTransactions = () => {
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Status', 'Order'];
    const rows = filteredTransactions.map((t) => [
      new Date(t.createdAt).toLocaleString(),
      transactionTypeConfig[t.type].label,
      t.description,
      t.type === 'debit' ? `-$${t.amount.toFixed(2)}` : `+$${t.amount.toFixed(2)}`,
      t.status,
      t.orderNumber || '-',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jetmed-wallet-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <CheckCircleIcon className="w-5 h-5" />
            Money added successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {actionError}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Wallet</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your JetMed balance</p>
        </div>
        <button
          onClick={() => setShowAddMoneyModal(true)}
          className="btn-primary mt-4 md:mt-0 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Money
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Balance Card */}
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-primary-600 to-secondary-600 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <WalletIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">Available Balance</p>
                    <p className="text-3xl font-bold">${walletData?.balance.toFixed(2)}</p>
                  </div>
                </div>
                {walletData?.pendingBalance && walletData.pendingBalance > 0 && (
                  <div className="text-right">
                    <p className="text-white/70 text-sm">Pending</p>
                    <p className="text-lg font-semibold">+${walletData.pendingBalance.toFixed(2)}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
                <div>
                  <p className="text-white/70 text-xs">Total Added</p>
                  <p className="font-semibold">${walletData?.totalCredited.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/70 text-xs">Total Spent</p>
                  <p className="font-semibold">${walletData?.totalSpent.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/70 text-xs">Cashback Earned</p>
                  <p className="font-semibold">${walletData?.totalCashback.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 flex gap-4">
              <button
                onClick={() => setShowAddMoneyModal(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowDownTrayIcon className="w-5 h-5 text-green-600" />
                <span className="font-medium">Add Money</span>
              </button>
              <Link
                to="/profile?tab=payments"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <CreditCardIcon className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Payment Methods</span>
              </Link>
            </div>
          </div>

          {/* Transactions */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transaction History</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportTransactions}
                  className="btn-ghost text-sm flex items-center gap-1"
                >
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="btn-ghost text-sm flex items-center gap-1"
                >
                  <FunnelIcon className="w-4 h-4" />
                  Filter
                </button>
              </div>
            </div>

            {/* Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="input"
                    >
                      <option value="all">All Types</option>
                      <option value="credit">Added Money</option>
                      <option value="debit">Payments</option>
                      <option value="refund">Refunds</option>
                      <option value="cashback">Cashback</option>
                      <option value="promo">Promo Credits</option>
                    </select>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="input"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                      <option value="3months">Last 3 Months</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Transaction List */}
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <BanknotesIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500">No transactions found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => {
                  const config = transactionTypeConfig[transaction.type];
                  const Icon = config.icon;
                  const isCredit = ['credit', 'refund', 'cashback', 'promo'].includes(transaction.type);

                  return (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{formatDate(transaction.createdAt)}</span>
                            {transaction.orderNumber && (
                              <>
                                <span>•</span>
                                <Link
                                  to={`/orders/${transaction.orderId}`}
                                  className="text-primary-600 hover:underline"
                                >
                                  {transaction.orderNumber}
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                          {isCredit ? '+' : '-'}${transaction.amount.toFixed(2)}
                        </p>
                        {transaction.status === 'pending' && (
                          <span className="text-xs text-yellow-600 flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Auto-Pay Settings */}
          <div className="card p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Auto-Pay Settings</h3>
            <p className="text-sm text-gray-500 mb-4">
              Automatically add money when your balance falls below a threshold
            </p>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer mb-4">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Enable Auto-Pay</p>
                <p className="text-sm text-gray-500">Keep your wallet funded automatically</p>
              </div>
              <input
                type="checkbox"
                checked={autoPayEnabled}
                onChange={(e) => setAutoPayEnabled(e.target.checked)}
                className="w-5 h-5 rounded text-primary-600"
              />
            </label>

            {autoPayEnabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    When balance falls below
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={autoPayThreshold}
                      onChange={(e) => setAutoPayThreshold(Number(e.target.value))}
                      className="input pl-7"
                      min="5"
                      max="100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Add this amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={autoPayAmount}
                      onChange={(e) => setAutoPayAmount(Number(e.target.value))}
                      className="input pl-7"
                      min="10"
                      max="500"
                    />
                  </div>
                </div>
                <button className="btn-primary w-full">Save Settings</button>
              </motion.div>
            )}
          </div>

          {/* Promo Code */}
          <div className="card p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Have a Promo Code?</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter code"
                className="input flex-1"
              />
              <button className="btn-primary">Apply</button>
            </div>
          </div>

          {/* Security Info */}
          <div className="card p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-green-800 dark:text-green-300">Secure Transactions</h3>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  All wallet transactions are encrypted and protected. Refunds are processed within 3-5 business days.
                </p>
              </div>
            </div>
          </div>

          {/* Help */}
          <div className="card p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Need Help?</h3>
            <div className="space-y-3">
              <a href="#" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <span className="text-sm font-medium">How do refunds work?</span>
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
              </a>
              <a href="#" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <span className="text-sm font-medium">Wallet FAQ</span>
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
              </a>
              <a href="#" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <span className="text-sm font-medium">Contact Support</span>
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Add Money Modal */}
      <AnimatePresence>
        {showAddMoneyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !isProcessing && setShowAddMoneyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Money to Wallet</h2>
                <button
                  onClick={() => !isProcessing && setShowAddMoneyModal(false)}
                  disabled={isProcessing}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Current Balance */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl mb-6">
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${walletData?.balance.toFixed(2)}
                </p>
              </div>

              {/* Quick Amounts */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Select Amount
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setAddAmount(amount)}
                      className={`py-3 rounded-xl font-medium transition-colors ${
                        addAmount === amount
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Or enter custom amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                  <input
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value ? Number(e.target.value) : '')}
                    className="input pl-8 text-lg"
                    placeholder="0.00"
                    min="1"
                    max="1000"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Payment Method
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border-2 transition-colors ${
                      selectedPaymentMethod === 'card'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={selectedPaymentMethod === 'card'}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="sr-only"
                    />
                    <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                      VISA
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">Visa •••• 4242</p>
                      <p className="text-sm text-gray-500">Expires 12/25</p>
                    </div>
                    {selectedPaymentMethod === 'card' && (
                      <CheckCircleIcon className="w-5 h-5 text-primary-600" />
                    )}
                  </label>

                  <label
                    className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border-2 transition-colors ${
                      selectedPaymentMethod === 'paypal'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="paypal"
                      checked={selectedPaymentMethod === 'paypal'}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="sr-only"
                    />
                    <div className="w-10 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">
                      PP
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">PayPal</p>
                      <p className="text-sm text-gray-500">john@example.com</p>
                    </div>
                    {selectedPaymentMethod === 'paypal' && (
                      <CheckCircleIcon className="w-5 h-5 text-primary-600" />
                    )}
                  </label>
                </div>

                <Link to="/profile?tab=payments" className="text-sm text-primary-600 hover:underline mt-2 inline-block">
                  + Add new payment method
                </Link>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-6">
                <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Money added to your wallet never expires and can be used for any purchase.
                </p>
              </div>

              {/* Add Button */}
              <button
                onClick={handleAddMoney}
                disabled={!addAmount || addAmount <= 0 || isProcessing}
                className="btn-primary w-full disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `Add $${addAmount || '0.00'} to Wallet`
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}