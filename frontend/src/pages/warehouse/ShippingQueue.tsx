import { useState, useEffect, useCallback } from 'react';
import {
  Truck, Package, User, MapPin, Search, RefreshCw, CheckCircle, Users, X, Star
} from 'lucide-react';
import api from '../../services/api';

interface PackedOrder {
  id: string;
  orderNumber: string;
  status: string;
  urgencyLevel: 'routine' | 'urgent' | 'emergency';
  deliveryType: string;
  totalAmount: number;
  prescriptionRequired: boolean;
  packedAt: string;
  packedBy?: string;
  items: Array<{
    id: string;
    quantity: number;
    medicine: { name: string };
  }>;
  user: {
    id: string;
    phone: string;
    profile: {
      firstName: string;
      lastName: string;
    };
  };
  deliveryAddress: {
    label: string;
    streetAddress: string;
    apartment?: string;
    city: string;
    state: string;
    zipCode: string;
    latitude?: number;
    longitude?: number;
    deliveryInstructions?: string;
  };
}

interface DeliveryPartner {
  id: string;
  userId: string;
  vehicleType: string;
  vehicleNumber: string;
  isOnline: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  totalDeliveries: number;
  rating: number;
  activeOrders: number;
  user: {
    profile: {
      firstName: string;
      lastName: string;
      avatar?: string;
    };
    phone: string;
  };
}

export default function ShippingQueue() {
  const [orders, setOrders] = useState<PackedOrder[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PackedOrder | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [filter, setFilter] = useState<'all' | 'packed' | 'assigned'>('packed');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const statuses = filter === 'all' ? 'packed,assigned_to_delivery' : filter === 'packed' ? 'packed' : 'assigned_to_delivery';
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

  const fetchDeliveryPartners = useCallback(async () => {
    try {
      const response = await api.get('/warehouse/delivery-partners?online=true');
      setDeliveryPartners(response.data?.data?.partners || []);
    } catch (error) {
      console.error('Failed to fetch delivery partners:', error);
      setDeliveryPartners([]);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchDeliveryPartners();
  }, [fetchOrders, fetchDeliveryPartners]);

  const assignToPartner = async (partnerId: string) => {
    if (!selectedOrder) return;

    try {
      setAssigning(true);
      setActionError('');
      setActionMessage('');
      await api.post(`/warehouse/orders/${selectedOrder.id}/assign`, {
        deliveryPartnerId: partnerId,
      });

      setShowAssignModal(false);
      setSelectedOrder(null);
      fetchOrders();
      fetchDeliveryPartners();
      setActionMessage('Order assigned successfully.');
    } catch (error) {
      console.error('Failed to assign order:', error);
      setActionError('Failed to assign order. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const broadcastOrder = async (order: PackedOrder) => {
    try {
      setActionError('');
      setActionMessage('');
      await api.post(`/warehouse/orders/${order.id}/broadcast`);
      setActionMessage('Order broadcasted to available delivery partners.');
    } catch (error) {
      console.error('Failed to broadcast order:', error);
      setActionError('Failed to broadcast order. Please try again.');
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500 animate-pulse' };
      case 'urgent':
        return { bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' };
      default:
        return { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
    }
  };

  const getTimeSincePacked = (packedAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(packedAt).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(query) ||
      order.user?.profile?.firstName?.toLowerCase().includes(query) ||
      order.user?.profile?.lastName?.toLowerCase().includes(query) ||
      order.deliveryAddress?.city?.toLowerCase().includes(query)
    );
  });

  const onlinePartners = deliveryPartners.filter((p) => p.isOnline);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipping Queue</h1>
            <p className="text-gray-600">Assign packed orders to delivery partners</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
              <Users className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">
                {onlinePartners.length} Partners Online
              </span>
            </div>
            <button
              onClick={() => {
                fetchOrders();
                fetchDeliveryPartners();
              }}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="px-6 py-4">
        {actionMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            {[
              { key: 'packed', label: 'Ready to Ship', count: orders.filter((o) => o.status === 'packed').length },
              { key: 'assigned', label: 'Assigned', count: orders.filter((o) => o.status === 'assigned_to_delivery').length },
              { key: 'all', label: 'All', count: orders.length },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as 'all' | 'packed' | 'assigned')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-6 pb-6">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders in queue</h3>
            <p className="text-gray-500">Packed orders will appear here for shipping</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const urgency = getUrgencyBadge(order.urgencyLevel);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Order Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${urgency.dot}`} />
                              <h3 className="font-bold text-gray-900">#{order.orderNumber}</h3>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgency.bg}`}>
                                {order.urgencyLevel.toUpperCase()}
                              </span>
                              {order.prescriptionRequired && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                  Rx
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              Packed {getTimeSincePacked(order.packedAt)} ago • {order.items?.length || 0} items
                            </p>
                          </div>
                          <span className="text-lg font-bold text-gray-900">
                            ${order.totalAmount?.toFixed(2) || '0.00'}
                          </span>
                        </div>

                        {/* Customer & Address */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {order.user?.profile?.firstName || ''} {order.user?.profile?.lastName || 'Customer'}
                              </p>
                              <p className="text-sm text-gray-500">{order.user?.phone || 'No phone'}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <MapPin className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {order.deliveryAddress?.streetAddress || 'Address not available'}
                                {order.deliveryAddress?.apartment && `, ${order.deliveryAddress.apartment}`}
                              </p>
                              <p className="text-sm text-gray-500">
                                {order.deliveryAddress?.city || ''}, {order.deliveryAddress?.state || ''} {order.deliveryAddress?.zipCode || ''}
                              </p>
                            </div>
                          </div>
                        </div>

                        {order.deliveryAddress?.deliveryInstructions && (
                          <div className="mt-3 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                            <strong>Note:</strong> {order.deliveryAddress?.deliveryInstructions}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex sm:flex-col gap-2">
                        {order.status === 'packed' ? (
                          <>
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowAssignModal(true);
                              }}
                              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                            >
                              <Truck className="w-4 h-4" />
                              Assign
                            </button>
                            <button
                              onClick={() => broadcastOrder(order)}
                              className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                            >
                              <Users className="w-4 h-4" />
                              Broadcast
                            </button>
                          </>
                        ) : (
                          <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Assigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Assign Delivery Partner</h2>
                <p className="text-sm text-gray-500">Order #{selectedOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedOrder(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {onlinePartners.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No delivery partners online</p>
                  <p className="text-sm text-gray-400 mt-1">Try broadcasting the order instead</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {onlinePartners.map((partner) => (
                    <div
                      key={partner.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {partner.user?.profile?.firstName || ''} {partner.user?.profile?.lastName || 'Partner'}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>{partner.vehicleType}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                {partner.rating?.toFixed(1) || '5.0'}
                              </span>
                              <span>•</span>
                              <span>{partner.totalDeliveries || 0} deliveries</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          {partner.activeOrders > 0 ? (
                            <span className="text-sm text-orange-600">
                              {partner.activeOrders} active
                            </span>
                          ) : (
                            <span className="text-sm text-green-600">Available</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => assignToPartner(partner.userId)}
                        disabled={assigning}
                        className="w-full mt-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {assigning ? 'Assigning...' : 'Assign to this Partner'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  broadcastOrder(selectedOrder);
                  setShowAssignModal(false);
                  setSelectedOrder(null);
                }}
                className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                Broadcast to All Partners Instead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
