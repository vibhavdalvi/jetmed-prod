import { useState, useEffect, useCallback } from 'react';
import {
  Package, CheckCircle, AlertCircle, Scan, Box, Printer, MapPin, User, X, Check
} from 'lucide-react';
import api from '../../services/api';

interface OrderToPack {
  id: string;
  orderNumber: string;
  status: string;
  urgencyLevel: 'routine' | 'urgent' | 'emergency';
  deliveryType: string;
  prescriptionRequired: boolean;
  createdAt: string;
  items: Array<{
    id: string;
    medicineId: string;
    dosageOptionId: string;
    quantity: number;
    medicine: {
      name: string;
      genericName: string;
      images: string[];
      dosageOptions: Array<{
        id: string;
        strength: string;
        unit: string;
      }>;
    };
  }>;
  user: {
    profile: {
      firstName: string;
      lastName: string;
    };
    phone: string;
  };
  deliveryAddress: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

interface PackingItem {
  itemId: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  quantity: number;
  packed: number;
  verified: boolean;
}

export default function PackOrders() {
  const [orders, setOrders] = useState<OrderToPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderToPack | null>(null);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'approved' | 'packing'>('approved');
  const [actionError, setActionError] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const statuses = filter === 'all' ? 'approved,packing' : filter;
      const response = await api.get(`/warehouse/orders?status=${statuses}`);
      const normalizedOrders = (response.data?.data?.orders || []).map((order: any) => ({
        ...order,
        items: order.items || order.orderItems || [],
      }));
      setOrders(normalizedOrders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const startPacking = (order: OrderToPack) => {
    setSelectedOrder(order);
    setPackingItems(
      order.items.map((item) => ({
        itemId: item.id,
        medicineId: item.medicineId,
        medicineName: item.medicine.name,
        dosage: item.medicine.dosageOptions?.[0]
          ? `${item.medicine.dosageOptions[0].strength}${item.medicine.dosageOptions[0].unit}`
          : '',
        quantity: item.quantity,
        packed: 0,
        verified: false,
      }))
    );
    setShowPackingModal(true);

    // Update status to packing if it's approved
    if (order.status === 'approved') {
      api.post(`/warehouse/orders/${order.id}/start-packing`).catch(console.error);
    }
  };

  const handleScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && scanInput) {
      // Find matching item by medicine name or barcode
      const itemIndex = packingItems.findIndex(
        (item) =>
          item.medicineName.toLowerCase().includes(scanInput.toLowerCase()) ||
          item.medicineId === scanInput
      );

      if (itemIndex !== -1) {
        const updated = [...packingItems];
        if (updated[itemIndex].packed < updated[itemIndex].quantity) {
          updated[itemIndex].packed += 1;
          if (updated[itemIndex].packed === updated[itemIndex].quantity) {
            updated[itemIndex].verified = true;
          }
          setPackingItems(updated);
        }
      }

      setScanInput('');
    }
  };

  const manualVerify = (index: number) => {
    const updated = [...packingItems];
    updated[index].packed = updated[index].quantity;
    updated[index].verified = true;
    setPackingItems(updated);
  };

  const undoVerify = (index: number) => {
    const updated = [...packingItems];
    updated[index].packed = 0;
    updated[index].verified = false;
    setPackingItems(updated);
  };

  const allItemsPacked = packingItems.every((item) => item.verified);

  const completePacking = async () => {
    if (!selectedOrder || !allItemsPacked) return;

    try {
      setSubmitting(true);
      setActionError('');
      await api.post(`/warehouse/orders/${selectedOrder.id}/complete-packing`);

      setShowPackingModal(false);
      setSelectedOrder(null);
      setPackingItems([]);
      fetchOrders();
    } catch (error) {
      console.error('Failed to complete packing:', error);
      setActionError('Failed to mark order as packed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const printLabel = (_order: OrderToPack) => {
    // In production, this would trigger label printing
    window.print();
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return 'bg-red-100 text-red-700 animate-pulse';
      case 'urgent':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTimeSinceOrder = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pack Orders</h1>
            <p className="text-gray-600 dark:text-gray-400">Pick and pack orders for delivery</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-gray-600 dark:text-gray-400">
                {orders.filter((o) => o.urgencyLevel === 'emergency').length} Emergency
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 bg-orange-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-400">
                {orders.filter((o) => o.urgencyLevel === 'urgent').length} Urgent
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4">
        <div className="flex gap-2">
          {[
            { key: 'approved', label: 'Ready to Pack', count: orders.filter((o) => o.status === 'approved').length },
            { key: 'packing', label: 'In Progress', count: orders.filter((o) => o.status === 'packing').length },
            { key: 'all', label: 'All', count: orders.length },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-emerald-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="px-6 pb-6">
        {actionError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}
        {orders.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm dark:bg-gray-800">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">No orders to pack</h3>
            <p className="text-gray-500 dark:text-gray-400">Orders will appear here once approved by pharmacists</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`overflow-hidden rounded-xl border-l-4 bg-white shadow-sm dark:bg-gray-800 ${
                  order.urgencyLevel === 'emergency'
                    ? 'border-red-500'
                    : order.urgencyLevel === 'urgent'
                    ? 'border-orange-500'
                    : 'border-emerald-500'
                }`}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-gray-900 dark:text-white">#{order.orderNumber}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{getTimeSinceOrder(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyBadge(
                          order.urgencyLevel
                        )}`}
                      >
                        {order.urgencyLevel.toUpperCase()}
                      </span>
                      {order.prescriptionRequired && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                          Rx
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="mb-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/40">
                    <p className="mb-2 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      {order.items?.length || 0} Item{(order.items?.length || 0) !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1">
                      {(order.items || []).slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-xs font-medium dark:bg-gray-700 dark:text-gray-200">
                            {item.quantity}
                          </span>
                          <span className="truncate text-gray-700 dark:text-gray-200">{item.medicine?.name || 'Unknown'}</span>
                        </div>
                      ))}
                      {(order.items?.length || 0) > 3 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">+{(order.items?.length || 0) - 3} more items</p>
                      )}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <User className="w-4 h-4" />
                    <span>
                      {order.user?.profile?.firstName || ''} {order.user?.profile?.lastName || 'Customer'}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{order.deliveryAddress?.city || 'Unknown'}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => printLabel(order)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <Printer className="w-4 h-4" />
                      Label
                    </button>
                    <button
                      onClick={() => startPacking(order)}
                      className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                    >
                      <Box className="w-4 h-4" />
                      {order.status === 'packing' ? 'Continue' : 'Start'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Packing Modal */}
      {showPackingModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-emerald-600 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-200 text-sm">Packing Order</p>
                  <h2 className="text-xl font-bold">#{selectedOrder.orderNumber}</h2>
                </div>
                <button
                  onClick={() => {
                    setShowPackingModal(false);
                    setSelectedOrder(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scan Input */}
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="relative">
                <Scan className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleScan}
                  placeholder="Scan barcode or enter medicine name..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg"
                  autoFocus
                />
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {packingItems.map((item, index) => (
                  <div
                    key={item.itemId}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      item.verified
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            item.verified
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {item.verified ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <span className="font-bold">{item.packed}/{item.quantity}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.medicineName}</p>
                          <p className="text-sm text-gray-500">{item.dosage}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          x{item.quantity}
                        </span>
                        {item.verified ? (
                          <button
                            onClick={() => undoVerify(index)}
                            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            onClick={() => manualVerify(index)}
                            className="px-3 py-1 text-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress & Complete */}
            <div className="px-6 py-4 border-t bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Packing Progress</p>
                  <p className="font-semibold text-gray-900">
                    {packingItems.filter((i) => i.verified).length} of {packingItems.length} items verified
                  </p>
                </div>
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${packingItems.length > 0 ? (packingItems.filter((i) => i.verified).length / packingItems.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <button
                onClick={completePacking}
                disabled={!allItemsPacked || submitting}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  'Processing...'
                ) : allItemsPacked ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Complete Packing
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    Verify All Items to Continue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}