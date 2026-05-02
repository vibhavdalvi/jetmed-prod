import { useState, useEffect, useCallback } from 'react';
import {
  Save, Bell, Mail, CreditCard, Truck,
  Shield, Globe, DollarSign, Package, AlertCircle,
  CheckCircle, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';

interface AppSettings {
  general: {
    siteName: string;
    supportEmail: string;
    supportPhone: string;
    timezone: string;
    currency: string;
  };
  delivery: {
    standardFee: number;
    expressFee: number;
    emergencyFee: number;
    freeDeliveryThreshold: number;
    maxDeliveryRadius: number;
    estimatedStandardTime: number;
    estimatedExpressTime: number;
  };
  orders: {
    minOrderAmount: number;
    maxItemsPerOrder: number;
    orderCancellationWindow: number;
    autoApproveOTC: boolean;
    requireSignature: boolean;
    requireOTPForRx: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    lowStockAlerts: boolean;
    lowStockThreshold: number;
  };
  payment: {
    stripeEnabled: boolean;
    codEnabled: boolean;
    walletEnabled: boolean;
    minWalletTopup: number;
    maxWalletBalance: number;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    requireEmailVerification: boolean;
    require2FA: boolean;
    passwordMinLength: number;
  };
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'delivery' | 'orders' | 'notifications' | 'payment' | 'security'>('general');
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const defaultSettings: AppSettings = {
    general: {
      siteName: 'JetMed',
      supportEmail: 'support@jetmed.com',
      supportPhone: '+1 (555) 123-4567',
      timezone: 'America/New_York',
      currency: 'USD',
    },
    delivery: {
      standardFee: 5.99,
      expressFee: 9.99,
      emergencyFee: 14.99,
      freeDeliveryThreshold: 50,
      maxDeliveryRadius: 25,
      estimatedStandardTime: 120,
      estimatedExpressTime: 60,
    },
    orders: {
      minOrderAmount: 10,
      maxItemsPerOrder: 20,
      orderCancellationWindow: 30,
      autoApproveOTC: true,
      requireSignature: false,
      requireOTPForRx: true,
    },
    notifications: {
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      orderUpdates: true,
      promotions: false,
      lowStockAlerts: true,
      lowStockThreshold: 20,
    },
    payment: {
      stripeEnabled: true,
      codEnabled: true,
      walletEnabled: true,
      minWalletTopup: 10,
      maxWalletBalance: 500,
    },
    security: {
      sessionTimeout: 60,
      maxLoginAttempts: 5,
      requireEmailVerification: true,
      require2FA: false,
      passwordMinLength: 8,
    },
  };

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/settings').catch(() => null);
      setSettings(response?.data?.data?.settings || defaultSettings);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = (section: keyof AppSettings, field: string, value: string | number | boolean) => {
    if (!settings) return;
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      };
    });
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      setSaveError('');
      await api.put('/admin/settings', settings);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const tabs = [
    { key: 'general', label: 'General', icon: Globe },
    { key: 'delivery', label: 'Delivery', icon: Truck },
    { key: 'orders', label: 'Orders', icon: Package },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'payment', label: 'Payment', icon: CreditCard },
    { key: 'security', label: 'Security', icon: Shield },
  ] as const;

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure your application settings</p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="inline-flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              Settings saved!
            </span>
          )}
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-yellow-800 text-sm">You have unsaved changes. Don't forget to save!</p>
        </div>
      )}

      {saveError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="bg-white rounded-xl shadow-sm p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
                    <input
                      type="text"
                      value={settings.general.siteName}
                      onChange={(e) => updateSettings('general', 'siteName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                      <input
                        type="email"
                        value={settings.general.supportEmail}
                        onChange={(e) => updateSettings('general', 'supportEmail', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
                      <input
                        type="tel"
                        value={settings.general.supportPhone}
                        onChange={(e) => updateSettings('general', 'supportPhone', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                      <select
                        value={settings.general.timezone}
                        onChange={(e) => updateSettings('general', 'timezone', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={settings.general.currency}
                        onChange={(e) => updateSettings('general', 'currency', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Settings */}
          {activeTab === 'delivery' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Settings</h3>
                <div className="grid gap-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Standard Fee ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.delivery.standardFee}
                        onChange={(e) => updateSettings('delivery', 'standardFee', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Express Fee ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.delivery.expressFee}
                        onChange={(e) => updateSettings('delivery', 'expressFee', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Fee ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.delivery.emergencyFee}
                        onChange={(e) => updateSettings('delivery', 'emergencyFee', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Free Delivery Threshold ($)</label>
                      <input
                        type="number"
                        value={settings.delivery.freeDeliveryThreshold}
                        onChange={(e) => updateSettings('delivery', 'freeDeliveryThreshold', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Orders above this amount get free delivery</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Delivery Radius (km)</label>
                      <input
                        type="number"
                        value={settings.delivery.maxDeliveryRadius}
                        onChange={(e) => updateSettings('delivery', 'maxDeliveryRadius', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Standard Delivery Time (mins)</label>
                      <input
                        type="number"
                        value={settings.delivery.estimatedStandardTime}
                        onChange={(e) => updateSettings('delivery', 'estimatedStandardTime', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Express Delivery Time (mins)</label>
                      <input
                        type="number"
                        value={settings.delivery.estimatedExpressTime}
                        onChange={(e) => updateSettings('delivery', 'estimatedExpressTime', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders Settings */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Settings</h3>
                <div className="grid gap-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Amount ($)</label>
                      <input
                        type="number"
                        value={settings.orders.minOrderAmount}
                        onChange={(e) => updateSettings('orders', 'minOrderAmount', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Items Per Order</label>
                      <input
                        type="number"
                        value={settings.orders.maxItemsPerOrder}
                        onChange={(e) => updateSettings('orders', 'maxItemsPerOrder', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Window (mins)</label>
                      <input
                        type="number"
                        value={settings.orders.orderCancellationWindow}
                        onChange={(e) => updateSettings('orders', 'orderCancellationWindow', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.orders.autoApproveOTC}
                        onChange={(e) => updateSettings('orders', 'autoApproveOTC', e.target.checked)}
                        className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Auto-approve OTC orders</p>
                        <p className="text-sm text-gray-500">Skip pharmacist review for non-prescription items</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.orders.requireSignature}
                        onChange={(e) => updateSettings('orders', 'requireSignature', e.target.checked)}
                        className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Require signature on delivery</p>
                        <p className="text-sm text-gray-500">Customer must sign upon receiving order</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.orders.requireOTPForRx}
                        onChange={(e) => updateSettings('orders', 'requireOTPForRx', e.target.checked)}
                        className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Require OTP for prescription orders</p>
                        <p className="text-sm text-gray-500">Verify delivery with one-time password</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Channels</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Email Notifications</p>
                        <p className="text-sm text-gray-500">Send updates via email</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.emailEnabled}
                      onChange={(e) => updateSettings('notifications', 'emailEnabled', e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">SMS Notifications</p>
                        <p className="text-sm text-gray-500">Send updates via text message</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.smsEnabled}
                      onChange={(e) => updateSettings('notifications', 'smsEnabled', e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Push Notifications</p>
                        <p className="text-sm text-gray-500">Send mobile push notifications</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.pushEnabled}
                      onChange={(e) => updateSettings('notifications', 'pushEnabled', e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                    />
                  </label>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.orderUpdates}
                      onChange={(e) => updateSettings('notifications', 'orderUpdates', e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                    />
                    <span className="text-gray-700">Order status updates</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.promotions}
                      onChange={(e) => updateSettings('notifications', 'promotions', e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                    />
                    <span className="text-gray-700">Promotional messages</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.lowStockAlerts}
                      onChange={(e) => updateSettings('notifications', 'lowStockAlerts', e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                    />
                    <span className="text-gray-700">Low stock alerts</span>
                  </label>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
                  <input
                    type="number"
                    value={settings.notifications.lowStockThreshold}
                    onChange={(e) => updateSettings('notifications', 'lowStockThreshold', parseInt(e.target.value) || 0)}
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when inventory falls below this number</p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Settings */}
          {activeTab === 'payment' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Credit/Debit Cards (Stripe)</p>
                        <p className="text-sm text-gray-500">Accept card payments</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.payment.stripeEnabled}
                      onChange={(e) => updateSettings('payment', 'stripeEnabled', e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Cash on Delivery</p>
                        <p className="text-sm text-gray-500">Pay when order is delivered</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.payment.codEnabled}
                      onChange={(e) => updateSettings('payment', 'codEnabled', e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Wallet Payments</p>
                        <p className="text-sm text-gray-500">Pay from wallet balance</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.payment.walletEnabled}
                      onChange={(e) => updateSettings('payment', 'walletEnabled', e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                    />
                  </label>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Wallet Settings</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Wallet Top-up ($)</label>
                    <input
                      type="number"
                      value={settings.payment.minWalletTopup}
                      onChange={(e) => updateSettings('payment', 'minWalletTopup', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Wallet Balance ($)</label>
                    <input
                      type="number"
                      value={settings.payment.maxWalletBalance}
                      onChange={(e) => updateSettings('payment', 'maxWalletBalance', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
                <div className="grid gap-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (mins)</label>
                      <input
                        type="number"
                        value={settings.security.sessionTimeout}
                        onChange={(e) => updateSettings('security', 'sessionTimeout', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Login Attempts</label>
                      <input
                        type="number"
                        value={settings.security.maxLoginAttempts}
                        onChange={(e) => updateSettings('security', 'maxLoginAttempts', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Password Length</label>
                      <input
                        type="number"
                        value={settings.security.passwordMinLength}
                        onChange={(e) => updateSettings('security', 'passwordMinLength', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.security.requireEmailVerification}
                        onChange={(e) => updateSettings('security', 'requireEmailVerification', e.target.checked)}
                        className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Require email verification</p>
                        <p className="text-sm text-gray-500">Users must verify email before ordering</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.security.require2FA}
                        onChange={(e) => updateSettings('security', 'require2FA', e.target.checked)}
                        className="w-5 h-5 text-emerald-600 rounded border-gray-300"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Require Two-Factor Authentication</p>
                        <p className="text-sm text-gray-500">Enforce 2FA for admin accounts</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset settings to defaults?"
        message="All unsaved custom settings will be replaced with default values."
        confirmLabel="Reset"
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={() => {
          setSettings(defaultSettings);
          setHasChanges(true);
          setShowResetConfirm(false);
        }}
      />
    </div>
  );
}
