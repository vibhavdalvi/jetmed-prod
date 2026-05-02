import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  MapPinIcon,
  TruckIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  ExclamationCircleIcon,
  CubeIcon,
  UserIcon,
  StarIcon,
  InformationCircleIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  MicrophoneIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import api from '../../services/api';

interface OrderItem {
  id: string;
  name: string;
  genericName: string;
  quantity: number;
  dosage: string;
  price: number;
  prescriptionRequired: boolean;
  image?: string;
}

interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  rating: number;
  vehicleType: string;
  vehicleNumber: string;
  currentLocation?: { lat: number; lng: number };
}

interface TimelineEvent {
  id: string;
  status: string;
  title: string;
  description: string;
  timestamp: string;
  actor?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'pharmacist';
  message: string;
  timestamp: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'packing' | 'ready_for_pickup' | 'out_for_delivery' | 'delivered' | 'cancelled';
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  tax: number;
  discount: number;
  total: number;
  deliveryType: 'express' | 'standard' | 'same_day' | 'scheduled';
  deliveryAddress: {
    label: string;
    street: string;
    apartment?: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates?: { lat: number; lng: number };
  };
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  createdAt: string;
  updatedAt: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  prescriptionStatus?: 'pending' | 'approved' | 'rejected' | 'more_info_requested';
  pharmacistNote?: string;
  deliveryPartner?: DeliveryPartner;
  timeline: TimelineEvent[];
  symptomsDescription?: string;
  prescriptionFiles?: Array<{
    id: string;
    url: string;
    status?: string;
    uploadedAt?: string;
  }>;
}

const statusStages = [
  { key: 'pending_review', label: 'Review', icon: ClockIcon },
  { key: 'approved', label: 'Approved', icon: CheckCircleIcon },
  { key: 'packing', label: 'Packing', icon: CubeIcon },
  { key: 'out_for_delivery', label: 'On the Way', icon: TruckIcon },
  { key: 'delivered', label: 'Delivered', icon: CheckCircleSolid },
];

const deliveryTypeLabels: Record<string, { label: string; time: string }> = {
  express: { label: 'Express Delivery', time: '30-60 minutes' },
  standard: { label: 'Standard Delivery', time: '1-2 hours' },
  same_day: { label: 'Same Day Delivery', time: '4-6 hours' },
  scheduled: { label: 'Scheduled Delivery', time: 'As scheduled' },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const mapApiOrderToOrderDetail = (apiOrder: any): Order => {
    const items = (apiOrder?.orderItems || apiOrder?.items || []).map((item: any, index: number) => {
      const dosageOption =
        item?.medicine?.dosageOptions?.find?.((d: any) => d.id === item.dosageOptionId) ||
        item?.medicine?.dosageOptions?.[0];
      return {
        id: item?.id || `item-${index}`,
        name: item?.medicine?.name || 'Unknown medicine',
        genericName: item?.medicine?.genericName || '',
        quantity: item?.quantity || 0,
        dosage: dosageOption ? `${dosageOption.strength}${dosageOption.unit}` : '',
        price: Number(item?.unitPrice || 0),
        prescriptionRequired: !!item?.prescriptionRequired,
        image: item?.medicine?.images?.[0],
      };
    });

    const timeline: TimelineEvent[] = [
      {
        id: 'event-created',
        status: 'created',
        title: 'Order Placed',
        description: 'Your order has been received',
        timestamp: apiOrder?.createdAt || new Date().toISOString(),
      },
    ];
    if (apiOrder?.reviewedAt) {
      timeline.push({
        id: 'event-reviewed',
        status: 'approved',
        title: 'Prescription Reviewed',
        description: 'Your order was reviewed by pharmacist',
        timestamp: apiOrder.reviewedAt,
      });
    }
    if (apiOrder?.packedAt) {
      timeline.push({
        id: 'event-packed',
        status: 'packing',
        title: 'Order Packed',
        description: 'Your order has been packed',
        timestamp: apiOrder.packedAt,
      });
    }
    if (apiOrder?.deliveryStartedAt) {
      timeline.push({
        id: 'event-delivery',
        status: 'out_for_delivery',
        title: 'Out for Delivery',
        description: 'Delivery partner is on the way',
        timestamp: apiOrder.deliveryStartedAt,
      });
    }
    if (apiOrder?.deliveredAt) {
      timeline.push({
        id: 'event-delivered',
        status: 'delivered',
        title: 'Delivered',
        description: 'Order delivered successfully',
        timestamp: apiOrder.deliveredAt,
      });
    }

    const orderStatus = apiOrder?.status === 'placed'
      ? 'pending_review'
      : apiOrder?.status === 'packed'
      ? 'ready_for_pickup'
      : apiOrder?.status || 'pending_review';

    return {
      id: apiOrder?.id || '',
      orderNumber: apiOrder?.orderNumber || 'Unknown',
      status: orderStatus,
      items,
      subtotal: Number(apiOrder?.subtotal || 0),
      deliveryFee: Number(apiOrder?.deliveryFee || 0),
      platformFee: Number(apiOrder?.platformFee || 0),
      tax: Number(apiOrder?.taxAmount || 0),
      discount: Number(apiOrder?.discountAmount || 0),
      total: Number(apiOrder?.totalAmount || 0),
      deliveryType: apiOrder?.deliveryType || 'standard',
      deliveryAddress: {
        label: apiOrder?.deliveryAddress?.label || 'Address',
        street: apiOrder?.deliveryAddress?.streetAddress || '',
        apartment: apiOrder?.deliveryAddress?.apartment,
        city: apiOrder?.deliveryAddress?.city || '',
        state: apiOrder?.deliveryAddress?.state || '',
        zipCode: apiOrder?.deliveryAddress?.zipCode || '',
      },
      paymentMethod: 'Card/Wallet',
      paymentStatus: apiOrder?.payments?.[0]?.status === 'refunded' ? 'refunded' : apiOrder?.payments?.[0]?.status === 'completed' ? 'paid' : 'pending',
      createdAt: apiOrder?.createdAt || new Date().toISOString(),
      updatedAt: apiOrder?.updatedAt || new Date().toISOString(),
      estimatedDelivery: undefined,
      deliveredAt: apiOrder?.deliveredAt,
      prescriptionStatus: apiOrder?.status === 'rejected' ? 'rejected' : apiOrder?.status === 'approved' ? 'approved' : 'pending',
      pharmacistNote: apiOrder?.pharmacistNotes || undefined,
      deliveryPartner: apiOrder?.deliveryPartner
        ? {
            id: apiOrder.deliveryPartner.id,
            name: `${apiOrder.deliveryPartner.profile?.firstName || ''} ${apiOrder.deliveryPartner.profile?.lastName || ''}`.trim() || 'Delivery Partner',
            phone: apiOrder.deliveryPartner.phone || '',
            rating: Number(apiOrder.deliveryPartner.rating || 5),
            vehicleType: apiOrder.deliveryPartner.vehicleType || 'Vehicle',
            vehicleNumber: apiOrder.deliveryPartner.vehicleNumber || '',
          }
        : undefined,
      timeline,
      symptomsDescription: apiOrder?.symptomsDescription || undefined,
      prescriptionFiles: (apiOrder?.prescriptions || [])
        .filter((prescription: any) => !!prescription?.imageUrl)
        .map((prescription: any) => ({
          id: prescription?.id || `${Date.now()}-${Math.random()}`,
          url: prescription.imageUrl,
          status: prescription?.status || undefined,
          uploadedAt: prescription?.createdAt || undefined,
        })),
    };
  };

  const getFileTypeLabel = (url: string): string => {
    const extension = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
    if (extension === 'pdf') return 'PDF';
    if (['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'].includes(extension)) return 'Image';
    if (extension) return extension.toUpperCase();
    return 'File';
  };

  const getPrescriptionStatusChip = (status?: string) => {
    if (status === 'approved' || status === 'verified') {
      return {
        label: 'Approved',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      };
    }
    if (status === 'rejected') {
      return {
        label: 'Rejected',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };
    }
    return {
      label: 'Pending Review',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    };
  };

  // Fetch order
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await api.get(`/orders/${id}`);
        const apiOrder = response.data?.data?.order;
        const apiPrescriptions = response.data?.data?.prescriptions || [];
        const enrichedOrder = { ...apiOrder, prescriptions: apiPrescriptions };
        setOrder(mapApiOrderToOrderDetail(enrichedOrder));
        if (apiOrder?.id) {
          const chatRes = await api.get(`/communication/chat/${apiOrder.id}`).catch(() => null);
          const msgs = chatRes?.data?.data?.messages || [];
          setChatMessages(
            msgs.map((m: any) => ({
              id: m.id || String(Date.now()),
              sender: m.senderId === apiOrder.userId ? 'user' : 'pharmacist',
              message: m.message || '',
              timestamp: m.timestamp || new Date().toISOString(),
            }))
          );
        }
      } catch (error) {
        console.error('Failed to fetch order:', error);
        setOrder(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Get current stage index
  const getCurrentStageIndex = (status: string) => {
    if (status === 'rejected' || status === 'cancelled') return -1;
    const index = statusStages.findIndex((s) => s.key === status);
    return index >= 0 ? index : 0;
  };

  // Send chat message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    if (!order) return;
    try {
      const response = await api.post('/communication/chat/send', {
        orderId: order.id,
        message: newMessage,
        type: 'text',
      });
      const sent = response.data?.data?.message;
      setChatMessages([
        ...chatMessages,
        {
          id: sent?.id || Date.now().toString(),
          sender: 'user',
          message: sent?.message || newMessage,
          timestamp: sent?.timestamp || new Date().toISOString(),
        },
      ]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send chat message:', error);
    }
  };

  // Start VoIP call
  const startCall = async (video: boolean = false) => {
    if (!order) return;
    try {
      await api.post('/communication/call/initiate', {
        orderId: order.id,
        type: video ? 'video' : 'audio',
      });
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  };

  // Cancel order
  const cancelOrder = async () => {
    try {
      await api.post(`/orders/${id}/cancel`, { reason: 'Cancelled by customer from order detail page' });
      setOrder((prev) => prev ? { ...prev, status: 'cancelled' } : null);
      setShowCancelModal(false);
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
  };

  // Download invoice
  const downloadInvoice = async () => {
    if (!order) return;
    try {
      const response = await api.get(`/orders/${order.id}/invoice`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${order.orderNumber}-invoice.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  };

  // Print invoice
  const printInvoice = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Order not found</h1>
        <Link to="/orders" className="btn-primary">Back to Orders</Link>
      </div>
    );
  }

  const currentStageIndex = getCurrentStageIndex(order.status);
  const isActive = ['pending_review', 'approved', 'packing', 'out_for_delivery'].includes(order.status);
  const canCancel = ['pending_review', 'approved'].includes(order.status);
  const canChat = ['pending_review', 'approved', 'packing'].includes(order.status);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{order.orderNumber}</h1>
            <p className="text-sm text-gray-500">
              Placed on {new Date(order.createdAt).toLocaleDateString()} at{' '}
              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={downloadInvoice} className="btn-ghost text-sm">
            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
            Invoice
          </button>
          <button onClick={printInvoice} className="btn-ghost text-sm">
            <PrinterIcon className="w-5 h-5 mr-2" />
            Print
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Tracker */}
          {order.status !== 'rejected' && order.status !== 'cancelled' && (
            <div className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Order Status</h2>
              
              {/* Progress Steps */}
              <div className="relative">
                <div className="flex justify-between">
                  {statusStages.map((stage, index) => {
                    const isCompleted = index <= currentStageIndex;
                    const isCurrent = index === currentStageIndex;
                    const StageIcon = stage.icon;

                    return (
                      <div key={stage.key} className="flex flex-col items-center relative z-10">
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: isCurrent ? 1.1 : 1 }}
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                            isCompleted
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                          } ${isCurrent ? 'ring-4 ring-primary-200 dark:ring-primary-900' : ''}`}
                        >
                          <StageIcon className="w-6 h-6" />
                        </motion.div>
                        <span
                          className={`mt-2 text-xs font-medium ${
                            isCompleted ? 'text-primary-600' : 'text-gray-400'
                          }`}
                        >
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Line */}
                <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 -z-0 mx-6">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentStageIndex / (statusStages.length - 1)) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-primary-600"
                  />
                </div>
              </div>

              {/* Estimated Delivery */}
              {isActive && order.estimatedDelivery && (
                <div className="mt-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ClockIcon className="w-6 h-6 text-primary-600" />
                      <div>
                        <p className="font-medium text-primary-700 dark:text-primary-300">Estimated Arrival</p>
                        <p className="text-2xl font-bold text-primary-600">
                          {new Date(order.estimatedDelivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{deliveryTypeLabels[order.deliveryType].label}</p>
                      <p className="text-sm text-gray-400">{deliveryTypeLabels[order.deliveryType].time}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rejected/Cancelled Notice */}
          {(order.status === 'rejected' || order.status === 'cancelled') && (
            <div className={`card p-6 border-2 ${
              order.status === 'rejected' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  order.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <XCircleIcon className={`w-6 h-6 ${order.status === 'rejected' ? 'text-red-600' : 'text-gray-500'}`} />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${order.status === 'rejected' ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                    Order {order.status === 'rejected' ? 'Rejected' : 'Cancelled'}
                  </h3>
                  {order.pharmacistNote && (
                    <p className="text-red-600 dark:text-red-400 mt-1">{order.pharmacistNote}</p>
                  )}
                  {order.paymentStatus === 'refunded' && (
                    <p className="text-sm text-gray-500 mt-2">
                      <CheckCircleIcon className="w-4 h-4 inline mr-1 text-green-500" />
                      Refund processed to your original payment method
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live Map (when out for delivery) */}
          {order.status === 'out_for_delivery' && order.deliveryPartner && (
            <div className="card overflow-hidden">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 relative">
                {/* Placeholder for actual map - would use Google Maps/Mapbox */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <TruckIcon className="w-12 h-12 mx-auto text-primary-600 mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">Live tracking map</p>
                    <p className="text-sm text-gray-500">Driver is {Math.floor(Math.random() * 10 + 5)} min away</p>
                  </div>
                </div>
                
                {/* Driver Info Overlay */}
                <div className="absolute bottom-4 left-4 right-4 card p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{order.deliveryPartner.name}</p>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <StarIcon className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          {order.deliveryPartner.rating} • {order.deliveryPartner.vehicleType}
                        </div>
                      </div>
                    </div>
                    
                     <a href={`tel:${order.deliveryPartner.phone}`}
                      className="btn-primary p-3 rounded-full"
                    >
                      <PhoneIcon className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Order Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="w-16 h-16 bg-white dark:bg-gray-700 rounded-xl flex items-center justify-center text-3xl shadow-sm">
                    💊
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3>
                      {item.prescriptionRequired && (
                        <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs rounded-full">
                          Rx
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{item.genericName} • {item.dosage}</p>
                    <p className="text-sm text-gray-400">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">${(item.price * item.quantity).toFixed(2)}</p>
                    <p className="text-sm text-gray-500">${item.price.toFixed(2)} each</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Uploaded Prescriptions */}
          {order.items.some((item) => item.prescriptionRequired) && (
            <div className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Uploaded Prescription Files</h2>
              {order.prescriptionFiles && order.prescriptionFiles.length > 0 ? (
                <div className="space-y-3">
                  {order.prescriptionFiles.map((file, index) => (
                    <div
                      key={`${file.id}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Prescription File {index + 1}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-primary-100 px-2 py-0.5 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                            {getFileTypeLabel(file.url)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${getPrescriptionStatusChip(file.status).className}`}
                          >
                            {getPrescriptionStatusChip(file.status).label}
                          </span>
                          {file.uploadedAt && (
                            <span className="text-gray-500 dark:text-gray-400">
                              Uploaded {new Date(file.uploadedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                          View
                        </a>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No prescription files were uploaded for this order.
                </p>
              )}
            </div>
          )}

          {/* Order Timeline */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Order Timeline</h2>
            <div className="space-y-4">
              {order.timeline.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${
                      index === order.timeline.length - 1 ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                    {index < order.timeline.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-white">{event.title}</h3>
                      <span className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{event.description}</p>
                    {event.actor && (
                      <p className="text-xs text-gray-400 mt-1">by {event.actor}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pharmacist Communication (Anonymous) */}
          {canChat && (
            <div className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Talk to Pharmacist</h2>
              <p className="text-sm text-gray-500 mb-4">
                Have questions about your medication? Chat or call anonymously with our pharmacist.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setShowChat(true)}
                  className="btn-outline flex flex-col items-center gap-1 py-3"
                >
                  <ChatBubbleLeftRightIcon className="w-5 h-5" />
                  <span className="text-xs">Chat</span>
                </button>
                <button
                  onClick={() => startCall(false)}
                  className="btn-outline flex flex-col items-center gap-1 py-3"
                >
                  <PhoneIcon className="w-5 h-5" />
                  <span className="text-xs">Voice</span>
                </button>
                <button
                  onClick={() => startCall(true)}
                  className="btn-outline flex flex-col items-center gap-1 py-3"
                >
                  <VideoCameraIcon className="w-5 h-5" />
                  <span className="text-xs">Video</span>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3 flex items-start gap-1">
                <InformationCircleIcon className="w-4 h-4 flex-shrink-0" />
                Your identity remains anonymous during pharmacist consultations
              </p>
            </div>
          )}

          {/* Delivery Address */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Delivery Address</h2>
            <div className="flex items-start gap-3">
              <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{order.deliveryAddress.label}</p>
                <p className="text-sm text-gray-500">
                  {order.deliveryAddress.street}
                  {order.deliveryAddress.apartment && `, ${order.deliveryAddress.apartment}`}
                </p>
                <p className="text-sm text-gray-500">
                  {order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zipCode}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Payment Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>${order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Fee</span>
                <span>{order.deliveryFee === 0 ? 'FREE' : `$${order.deliveryFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Platform Fee</span>
                <span>${order.platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax</span>
                <span>${order.tax.toFixed(2)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${order.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary-600">${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Payment Method</span>
                <span className="font-medium">{order.paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-500">Payment Status</span>
                <span className={`font-medium ${
                  order.paymentStatus === 'paid' ? 'text-green-600' :
                  order.paymentStatus === 'refunded' ? 'text-orange-600' :
                  'text-gray-600'
                }`}>
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {canCancel && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="btn bg-red-100 text-red-700 hover:bg-red-200 w-full"
            >
              Cancel Order
            </button>
          )}

          {order.status === 'delivered' && (
            <Link to="/medicines" className="btn-primary w-full text-center">
              Order Again
            </Link>
          )}
        </div>
      </div>

      {/* Chat Modal */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
            onClick={() => setShowChat(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md h-[80vh] sm:h-[600px] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Pharmacist</p>
                    <p className="text-xs text-green-500">Online</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startCall(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <PhoneIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowChat(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <p className="text-center text-xs text-gray-400 mb-4">
                  Your identity is anonymous to the pharmacist
                </p>
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl ${
                        msg.sender === 'user'
                          ? 'bg-primary-600 text-white rounded-br-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-primary-200' : 'text-gray-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="input flex-1"
                  />
                  <button onClick={sendMessage} className="btn-primary p-3 rounded-full">
                    <PaperAirplaneIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Order Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <ExclamationCircleIcon className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Cancel Order?</h3>
                <p className="text-gray-500 mb-6">
                  Are you sure you want to cancel this order? Your payment will be refunded within 3-5 business days.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowCancelModal(false)} className="btn-ghost flex-1">
                    Keep Order
                  </button>
                  <button onClick={cancelOrder} className="btn bg-red-600 text-white hover:bg-red-700 flex-1">
                    Cancel Order
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
