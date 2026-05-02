import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Navigation, Phone, MessageCircle, Package, CheckCircle, Camera,
  AlertCircle, Clock, Home, ChevronRight, Shield, X, Loader2
} from 'lucide-react';
import api from '../../services/api';

interface OrderDetails {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  deliveryType: string;
  prescriptionRequired: boolean;
  deliveryOTP?: string;
  items: Array<{
    id: string;
    quantity: number;
    medicine: {
      name: string;
      images: string[];
    };
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
  warehouse: {
    name: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  };
}

interface RawOrderDetails extends Partial<OrderDetails> {
  orderItems?: Array<{
    id: string;
    quantity: number;
    medicine?: {
      name?: string;
      images?: string[];
    };
  }>;
}

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

// FIX: Use ONLY valid backend OrderStatus values
const deliverySteps = [
  { key: 'assigned_to_delivery', label: 'Assigned', icon: Package },
  { key: 'out_for_delivery', label: 'On The Way', icon: Navigation },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function ActiveDelivery() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [location, setLocation] = useState<Location | null>(null);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [actionError, setActionError] = useState('');
  const [verifiedOtp, setVerifiedOtp] = useState('');

  // Refs for cleanup
  const watchIdRef = useRef<number | null>(null);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch order details
  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/orders/${orderId}`);
      const rawOrderData = (response.data?.data?.order || response.data?.order) as RawOrderDetails;
      
      if (!rawOrderData) {
        throw new Error('Order not found');
      }

      const normalizedItems =
        (rawOrderData.orderItems || rawOrderData.items || []).map((item: any, index: number) => ({
          id: item.id || `${rawOrderData.id || 'order'}-${index}`,
          quantity: item.quantity || 0,
          medicine: {
            name: item.medicine?.name || item.medicineName || 'Unknown medicine',
            images: item.medicine?.images || [],
          },
        }));

      const orderData: OrderDetails = {
        ...(rawOrderData as OrderDetails),
        items: normalizedItems,
      };

      setOrder(orderData);

      // FIX: Map to valid backend statuses only
      const statusStepMap: Record<string, number> = {
        assigned_to_delivery: 0,
        out_for_delivery: 1,
        delivered: 2,
      };
      setCurrentStep(statusStepMap[orderData.status] ?? 0);
    } catch (error) {
      console.error('Failed to fetch order:', error);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // Start location tracking
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Update location to server periodically (throttled to every 10 seconds)
  useEffect(() => {
    if (!location || !order) return;

    const updateLocation = async () => {
      try {
        await api.patch(`/delivery/${order.id}/location`, {
          latitude: location.latitude,
          longitude: location.longitude,
        });
      } catch (error) {
        console.error('Failed to update location:', error);
      }
    };

    // Update immediately
    updateLocation();

    // Then update every 10 seconds
    locationUpdateIntervalRef.current = setInterval(updateLocation, 10000);

    return () => {
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current);
      }
    };
  }, [location?.latitude, location?.longitude, order?.id]);

  const updateOrderStatus = async (newStatus: string) => {
    if (!order) return;

    try {
      setSubmitting(true);
      setActionError('');
      await api.patch(`/orders/${order.id}/status`, { status: newStatus });
      
      // Update local state
      const statusStepMap: Record<string, number> = {
        assigned_to_delivery: 0,
        out_for_delivery: 1,
        delivered: 2,
      };
      setCurrentStep(statusStepMap[newStatus] ?? currentStep);
      setOrder(prev => prev ? { ...prev, status: newStatus } : null);

      if (newStatus === 'delivered') {
        // Redirect to dashboard after successful delivery
        setTimeout(() => navigate('/delivery'), 2000);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      setActionError('Failed to update delivery status. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newOtp = [...otpInput];
    newOtp[index] = value;
    setOtpInput(newOtp);
    setOtpError('');

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const verifyOTP = async () => {
    const otp = otpInput.join('');
    if (otp.length !== 6) {
      setOtpError('Please enter complete OTP');
      return;
    }

    try {
      setVerifyingOTP(true);
      await api.post(`/orders/${order?.id}/verify-otp`, { otp });
      setShowOTPModal(false);
      setVerifiedOtp(otp);
      setOtpInput(['', '', '', '', '', '']);
      
      // OTP verified - now show proof modal or complete delivery
      setShowProofModal(true);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setOtpError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setVerifyingOTP(false);
    }
  };

  const handleProofCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofImage(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const submitDeliveryProof = async () => {
    if (!order) return;

    try {
      setSubmitting(true);
      setActionError('');
      await api.post(`/delivery/${order.id}/complete`, {
        otp: order.prescriptionRequired ? verifiedOtp : undefined,
        photoProof: proofPreview || undefined,
      });
      setCurrentStep(2);
      setOrder(prev => (prev ? { ...prev, status: 'delivered' } : null));
      setShowProofModal(false);
      setOtpInput(['', '', '', '', '', '']);
      setVerifiedOtp('');
      setTimeout(() => navigate('/delivery'), 2000);
    } catch (error) {
      console.error('Failed to submit proof:', error);
      setActionError('Failed to complete delivery. Please verify details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openMapsNavigation = (lat?: number, lng?: number, address?: string) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else if (address) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    }
  };

  const callCustomer = () => {
    if (order?.user?.phone) {
      window.location.href = `tel:${order.user.phone}`;
    }
  };

  // FIX: Only use valid backend statuses
  const getNextAction = () => {
    switch (currentStep) {
      case 0: // assigned_to_delivery
        return { label: 'Start Delivery', status: 'out_for_delivery', color: 'bg-emerald-600' };
      case 1: // out_for_delivery
        return { 
          label: 'Complete Delivery', 
          status: 'delivered', 
          color: 'bg-green-600', 
          requiresOTP: order?.prescriptionRequired 
        };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading delivery details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-4">This delivery may have been reassigned or cancelled.</p>
          <button
            onClick={() => navigate('/delivery')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const nextAction = getNextAction();

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-emerald-100 text-sm">Order #{order.orderNumber}</p>
            <h1 className="text-xl font-bold">Active Delivery</h1>
          </div>
          <div className="flex items-center gap-2">
            {order.prescriptionRequired && (
              <span className="bg-yellow-500 text-yellow-900 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Rx Required
              </span>
            )}
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
              ${order.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Progress Steps - Simplified to match backend */}
        <div className="flex items-center justify-between">
          {deliverySteps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-white text-emerald-600' :
                      isCurrent ? 'bg-yellow-400 text-yellow-900' :
                      'bg-emerald-500 text-emerald-200'
                    }`}
                  >
                    <StepIcon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold' : 'text-emerald-200'}`}>
                    {step.label}
                  </span>
                </div>
                {index < deliverySteps.length - 1 && (
                  <div className={`w-full h-1 mx-2 rounded ${index < currentStep ? 'bg-white' : 'bg-emerald-500'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Location Status */}
      {location && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700 text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            GPS Active • Accuracy: {Math.round(location.accuracy)}m
          </div>
          <span className="text-blue-600 text-xs">
            {new Date(location.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {actionError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {actionError}
          </div>
        )}
        {/* Pickup Location (Warehouse) */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-blue-600 font-medium uppercase">Pickup From</p>
                <h3 className="font-semibold text-gray-900">{order.warehouse?.name || 'Warehouse'}</h3>
                <p className="text-sm text-gray-600 truncate">
                  {order.warehouse?.address || 'Address not available'}, {order.warehouse?.city || ''}
                </p>
              </div>
              <button
                onClick={() => openMapsNavigation(order.warehouse?.latitude, order.warehouse?.longitude)}
                className="p-2 bg-blue-50 rounded-lg text-blue-600 hover:bg-blue-100 flex-shrink-0"
              >
                <Navigation className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Order Items */}
          <div className="p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">
              {order.items?.length || 0} Item{(order.items?.length || 0) !== 1 ? 's' : ''} to Pickup
            </p>
            <div className="space-y-2">
              {order.items?.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 bg-white rounded flex items-center justify-center text-gray-600 font-medium">
                    {item.quantity}x
                  </span>
                  <span className="text-gray-700">{item.medicine?.name || 'Unknown medicine'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Delivery Destination */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Home className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-600 font-medium uppercase">Deliver To</p>
                <h3 className="font-semibold text-gray-900">
                  {order.user?.profile?.firstName || ''} {order.user?.profile?.lastName || 'Customer'}
                </h3>
                <p className="text-sm text-gray-600">
                  {order.deliveryAddress?.streetAddress || 'Address not available'}
                  {order.deliveryAddress?.apartment && `, ${order.deliveryAddress.apartment}`}
                </p>
                <p className="text-sm text-gray-600">
                  {order.deliveryAddress?.city || ''}, {order.deliveryAddress?.state || ''} {order.deliveryAddress?.zipCode || ''}
                </p>
                {order.deliveryAddress?.label && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                    {order.deliveryAddress.label}
                  </span>
                )}
              </div>
              <button
                onClick={() => openMapsNavigation(
                  order.deliveryAddress?.latitude,
                  order.deliveryAddress?.longitude,
                  `${order.deliveryAddress?.streetAddress || ''}, ${order.deliveryAddress?.city || ''}`
                )}
                className="p-2 bg-emerald-50 rounded-lg text-emerald-600 hover:bg-emerald-100 flex-shrink-0"
              >
                <Navigation className="w-5 h-5" />
              </button>
            </div>

            {/* Delivery Instructions */}
            {order.deliveryAddress?.deliveryInstructions && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-yellow-700 font-medium uppercase mb-1">Delivery Instructions</p>
                <p className="text-sm text-yellow-800">{order.deliveryAddress.deliveryInstructions}</p>
              </div>
            )}
          </div>

          {/* Contact Customer */}
          <div className="border-t border-gray-100 p-4">
            <div className="flex gap-2">
              <button
                onClick={callCustomer}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call Customer
              </button>
              <button
                onClick={() => setShowContactModal(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </button>
            </div>
          </div>
        </div>

        {/* Prescription Warning */}
        {order.prescriptionRequired && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900">Prescription Verification Required</h3>
                <p className="text-sm text-amber-700 mt-1">
                  This order contains prescription medicines. You must verify the 6-digit OTP 
                  from the customer before handing over the package.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Time Estimate */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Estimated Delivery</p>
              <p className="font-semibold text-gray-900">
                {order.deliveryType === 'express' ? '30-45 minutes' :
                 order.deliveryType === 'emergency' ? '15-30 minutes' :
                 '45-90 minutes'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action */}
      {nextAction && currentStep < 2 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <button
            onClick={() => {
              if (nextAction.requiresOTP) {
                setShowOTPModal(true);
              } else if (nextAction.status === 'delivered') {
                setShowProofModal(true);
              } else {
                updateOrderStatus(nextAction.status);
              }
            }}
            disabled={submitting}
            className={`w-full py-4 ${nextAction.color} text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50`}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {nextAction.label}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Delivery Complete State */}
      {currentStep === 2 && (
        <div className="fixed bottom-0 left-0 right-0 bg-green-600 text-white p-6 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-2" />
          <h2 className="text-xl font-bold">Delivery Complete!</h2>
          <p className="text-green-100 mt-1">Great job! Redirecting to dashboard...</p>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOTPModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Verify OTP</h2>
              <button onClick={() => setShowOTPModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-6">
              <Shield className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <p className="text-gray-600">
                Ask the customer for the 6-digit OTP they received to verify this prescription delivery.
              </p>
            </div>

            <div className="flex gap-2 justify-center mb-4">
              {otpInput.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOTPChange(index, e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => handleOTPKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
              ))}
            </div>

            {otpError && (
              <p className="text-red-500 text-sm text-center mb-4">{otpError}</p>
            )}

            <button
              onClick={verifyOTP}
              disabled={verifyingOTP || otpInput.some(d => !d)}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifyingOTP ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Verify OTP'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Delivery Proof Modal */}
      {showProofModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Delivery Proof</h2>
              <button onClick={() => setShowProofModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-6">
              <p className="text-gray-600">
                Take a photo of the delivered package as proof of delivery.
              </p>
            </div>

            {proofPreview ? (
              <div className="mb-4">
                <img src={proofPreview} alt="Delivery proof" className="w-full rounded-lg" />
                <button
                  onClick={() => {
                    setProofImage(null);
                    setProofPreview(null);
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Remove & Retake
                </button>
              </div>
            ) : (
              <label className="block mb-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 transition-colors">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 font-medium">Tap to take photo</p>
                  <p className="text-sm text-gray-400">or upload from gallery</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleProofCapture}
                  className="hidden"
                />
              </label>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowProofModal(false);
                  if (order.prescriptionRequired && !verifiedOtp) {
                    setActionError('OTP verification is required before completing this delivery.');
                    return;
                  }
                  submitDeliveryProof();
                }}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold"
              >
                Skip
              </button>
              <button
                onClick={submitDeliveryProof}
                disabled={!proofImage || submitting}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Complete Delivery'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-6">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-bold text-gray-900 mb-4">Contact Customer</h3>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  callCustomer();
                  setShowContactModal(false);
                }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Phone className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Call</p>
                  <p className="text-sm text-gray-500">{order.user?.phone || 'No phone'}</p>
                </div>
              </button>

              <button
                onClick={() => {
                  if (order.user?.phone) {
                    window.location.href = `sms:${order.user.phone}`;
                  }
                  setShowContactModal(false);
                }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Text Message</p>
                  <p className="text-sm text-gray-500">Send SMS</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowContactModal(false)}
              className="w-full mt-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}