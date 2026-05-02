import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPinIcon,
  TruckIcon,
  DocumentTextIcon,
  CreditCardIcon,
  CheckCircleIcon,
  PlusIcon,
  ClockIcon,
  BoltIcon,
  CalendarIcon,
  CloudArrowUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useDropzone } from 'react-dropzone';
import { useAppDispatch, useAppSelector } from '../../features/hooks';
import { clearCart } from '../../features/cart/cartSlice';
import api from '../../services/api';

interface Address {
  id: string;
  label: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
}

interface CartItem {
  id: string;
  medicineId: string;
  name: string;
  genericName: string;
  dosageOption: { id: string; strength: string; unit: string; price: number };
  quantity: number;
  prescriptionRequired: boolean;
}

const steps = [
  { id: 1, name: 'Address', icon: MapPinIcon },
  { id: 2, name: 'Delivery', icon: TruckIcon },
  { id: 3, name: 'Prescription', icon: DocumentTextIcon },
  { id: 4, name: 'Payment', icon: CreditCardIcon },
  { id: 5, name: 'Review', icon: CheckCircleIcon },
];

const deliveryOptions = [
  { id: 'express', name: 'Express', time: '30-60 min', price: 9.99, icon: BoltIcon, description: 'Fastest delivery' },
  { id: 'standard', name: 'Standard', time: '1-2 hours', price: 5.99, icon: TruckIcon, description: 'Regular delivery' },
  { id: 'same_day', name: 'Same Day', time: '4-6 hours', price: 3.99, icon: ClockIcon, description: 'Delivery today' },
  { id: 'scheduled', name: 'Scheduled', time: 'Choose time', price: 3.99, icon: CalendarIcon, description: 'Pick a slot' },
];

const paymentOptions = [
  { id: 'wallet', label: 'JetMed Wallet', description: 'Instant confirmation from wallet balance', enabled: true },
  { id: 'card', label: 'Credit/Debit Card', description: 'Temporarily disabled in this demo build', enabled: false },
  { id: 'paypal', label: 'PayPal', description: 'Temporarily disabled in this demo build', enabled: false },
] as const;

function normalizeAddressRows(rows: any[]): Address[] {
  const mapped = (rows || []).map((addr: any) => {
    const id = addr?.id != null ? String(addr.id) : addr?._id != null ? String(addr._id) : '';
    return {
      id,
      label: addr.label ?? '',
      street: addr.streetAddress ?? addr.street ?? '',
      apartment: addr.apartment,
      city: addr.city ?? '',
      state: addr.state ?? '',
      zipCode: addr.zipCode ?? '',
      isDefault: Boolean(addr.isDefault),
    };
  });
  const seen = new Set<string>();
  return mapped.filter((a) => {
    if (!a.id || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const cartItems = useAppSelector((state) => state.cart.items) as unknown as CartItem[];

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderRouteId, setOrderRouteId] = useState<string | null>(null);

  // Form state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [selectedDelivery, setSelectedDelivery] = useState('standard');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [prescriptionFiles, setPrescriptionFiles] = useState<File[]>([]);
  const [symptoms, setSymptoms] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [saveCard, setSaveCard] = useState(false);
  const [actionError, setActionError] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const hasPrescriptionItems = cartItems.some((item) => item.prescriptionRequired);
  const visibleSteps = steps.filter((step) => hasPrescriptionItems || step.id !== 3);

  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const [addressResponse, walletResponse] = await Promise.all([
          api.get('/users/me/addresses'),
          api.get('/payments/wallet'),
        ]);
        const loaded = normalizeAddressRows(addressResponse.data.data?.addresses || []);
        setAddresses(loaded);
        setSelectedAddressId((prev) => {
          if (prev && loaded.some((a) => a.id === prev)) return prev;
          const defaultAddress = loaded.find((a) => a.isDefault) || loaded[0];
          return defaultAddress?.id || '';
        });
        setWalletBalance(Number(walletResponse.data?.data?.wallet?.balance || 0));
      } catch (error) {
        console.error('Failed to load addresses:', error);
        setActionError('Unable to load checkout prerequisites. Add an address and ensure wallet is available.');
      }
    };
    loadAddresses();
  }, [location.key]);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.dosageOption.price * item.quantity, 0);
  const deliveryOption = deliveryOptions.find((d) => d.id === selectedDelivery);
  const deliveryFee = subtotal >= 50 ? 0 : deliveryOption?.price || 5.99;
  const platformFee = 1.99;
  const tax = subtotal * 0.08;
  const total = subtotal + deliveryFee + platformFee + tax;

  // Dropzone for prescription upload
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      setPrescriptionFiles((prev) => [...prev, ...acceptedFiles]);
    },
  });

  const removePrescription = (index: number) => {
    setPrescriptionFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const viewPrescriptionFile = (file: File) => {
    const fileUrl = URL.createObjectURL(file);
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(fileUrl), 15000);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return !!selectedAddressId;
      case 2: return !!selectedDelivery && (selectedDelivery !== 'scheduled' || (scheduledDate && scheduledTime));
      case 3: return !hasPrescriptionItems || prescriptionFiles.length > 0;
      case 4:
        if (paymentMethod === 'wallet') return walletBalance >= total;
        return false;
      default: return true;
    }
  };

  const nextStep = () => {
    if (currentStep < 5 && canProceed()) {
      // Skip prescription step if no Rx items
      if (currentStep === 2 && !hasPrescriptionItems) {
        setCurrentStep(4);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      if (currentStep === 4 && !hasPrescriptionItems) {
        setCurrentStep(2);
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  };

  const uploadPrescriptions = async (): Promise<string[]> => {
    if (prescriptionFiles.length === 0) return [];

    const uploadedIds: string[] = [];
    for (const file of prescriptionFiles) {
      try {
        const formData = new FormData();
        formData.append('prescription', file);
        const response = await api.post('/prescriptions/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const prescriptionId = response.data?.data?.prescription?.id;
        if (prescriptionId) {
          uploadedIds.push(prescriptionId);
        }
      } catch (uploadError) {
        console.error(`Failed to upload prescription file "${file.name}"`, uploadError);
      }
    }
    return uploadedIds;
  };

  const placeOrder = async () => {
    setLoading(true);
    let createdOrderId: string | null = null;
    try {
      setActionError('');
      setPaymentMessage('');
      if (paymentMethod !== 'wallet') {
        setActionError('Only wallet checkout is enabled in this demo. Please switch to JetMed Wallet.');
        return;
      }

      if (walletBalance < total) {
        setActionError(`Insufficient wallet balance. Need $${total.toFixed(2)}, available $${walletBalance.toFixed(2)}.`);
        return;
      }

      const uploadedPrescriptionIds = await uploadPrescriptions();
      if (hasPrescriptionItems && uploadedPrescriptionIds.length === 0) {
        setActionError('Please upload at least one prescription file to continue with this order.');
        return;
      }
      const response = await api.post('/orders', {
        addressId: selectedAddressId,
        items: cartItems.map((item) => ({
          medicineId: item.medicineId,
          dosageOptionId: item.dosageOption.id,
          quantity: item.quantity,
        })),
        deliveryType: selectedDelivery,
        symptomsDescription: symptoms || undefined,
        prescriptionIds: uploadedPrescriptionIds,
      });
      const createdOrder = response.data.data?.order;
      if (!createdOrder?.id) {
        throw new Error('Order was created without an ID');
      }
      createdOrderId = createdOrder.id;

      await api.post('/payments/wallet/pay', { orderId: createdOrder.id });

      setOrderId(createdOrder?.orderNumber || createdOrder?.id || '');
      setOrderRouteId(createdOrder.id);
      setWalletBalance((prev) => Math.max(0, prev - total));
      setPaymentMessage('Payment completed from wallet.');
      dispatch(clearCart());
      setOrderPlaced(true);
    } catch (error: any) {
      if (createdOrderId) {
        try {
          await api.post(`/orders/${createdOrderId}/cancel`, {
            reason: 'Auto-cancelled because payment did not complete',
          });
        } catch (cancelError) {
          console.error('Failed to auto-cancel unpaid order:', cancelError);
        }
      }
      console.error('Failed to place order:', error);
      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        error?.message ||
        'Failed to complete checkout. Please verify wallet balance and try again.';
      setActionError(serverMessage);
    } finally {
      setLoading(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md mx-auto px-4 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
          >
            <CheckCircleIcon className="w-14 h-14 text-green-500" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Order Placed!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your order <span className="font-semibold text-primary-600">{orderId}</span> has been placed successfully.
          </p>
          {paymentMessage && (
            <p className="text-sm text-green-600 dark:text-green-400 mb-3">{paymentMessage}</p>
          )}
          {hasPrescriptionItems && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-6">
              A pharmacist will review your prescription and call you shortly.
            </p>
          )}
          <div className="space-y-3">
            <button onClick={() => navigate(`/orders/${orderRouteId || orderId}`)} className="btn-primary w-full">
              Track Order
            </button>
            <button onClick={() => navigate('/medicines')} className="btn-outline w-full">
              Continue Shopping
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        {actionError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {actionError}
          </div>
        )}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {visibleSteps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              
              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-initial">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      isActive
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : isCompleted
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircleIcon className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium hidden sm:block ${
                      isActive ? 'text-primary-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {step.name}
                  </span>
                  {index < visibleSteps.length - 1 && (
                    <div
                      className={`h-0.5 mx-3 md:mx-4 flex-1 min-w-[24px] ${
                        step.id < currentStep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {/* Step 1: Address */}
              {currentStep === 1 && (
                <motion.div
                  key="address"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card p-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Delivery Address</h2>
                {addresses.length === 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    No saved addresses found. Add one from your profile before checkout.
                  </div>
                )}
                  <div className="space-y-4">
                    {addresses.map((address) => (
                      <label
                        key={address.id}
                        className={`block p-4 border-2 rounded-xl cursor-pointer transition ${
                          selectedAddressId === address.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <input
                            type="radio"
                            name="checkout-delivery-address"
                            value={address.id}
                            checked={selectedAddressId === address.id}
                            onChange={() => setSelectedAddressId(address.id)}
                            className="mt-1 mr-3"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-white">{address.label}</span>
                              {address.isDefault && <span className="badge-primary text-xs">Default</span>}
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                              {address.street}{address.apartment && `, ${address.apartment}`}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              {address.city}, {address.state} {address.zipCode}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => navigate('/profile?tab=addresses')}
                      className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 hover:border-primary-500 hover:text-primary-600 transition flex items-center justify-center gap-2"
                    >
                      <PlusIcon className="w-5 h-5" />
                      Add New Address
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Delivery */}
              {currentStep === 2 && (
                <motion.div
                  key="delivery"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card p-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Delivery Speed</h2>
                  <div className="space-y-4">
                    {deliveryOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`block p-4 border-2 rounded-xl cursor-pointer transition ${
                          selectedDelivery === option.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                        }`}
                      >
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="delivery"
                            value={option.id}
                            checked={selectedDelivery === option.id}
                            onChange={() => setSelectedDelivery(option.id)}
                            className="mr-3"
                          />
                          <option.icon className="w-6 h-6 text-primary-500 mr-3" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-gray-900 dark:text-white">{option.name}</span>
                              <span className="font-semibold text-primary-600">
                                {subtotal >= 50 && option.id !== 'express' ? 'FREE' : `$${option.price.toFixed(2)}`}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{option.time} • {option.description}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {selectedDelivery === 'scheduled' && (
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <h3 className="font-medium mb-4">Select Date & Time</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Date</label>
                          <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="input"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Time Slot</label>
                          <select
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="input"
                          >
                            <option value="">Select time</option>
                            <option value="09:00-12:00">9:00 AM - 12:00 PM</option>
                            <option value="12:00-15:00">12:00 PM - 3:00 PM</option>
                            <option value="15:00-18:00">3:00 PM - 6:00 PM</option>
                            <option value="18:00-21:00">6:00 PM - 9:00 PM</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Prescription */}
              {currentStep === 3 && hasPrescriptionItems && (
                <motion.div
                  key="prescription"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card p-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Upload Prescription</h2>
                  <p className="text-gray-500 mb-6">
                    Your order contains prescription medicines. Upload at least one file to continue.
                  </p>

                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                      isDragActive
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <CloudArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {isDragActive ? 'Drop files here...' : 'Drag & drop prescription files, or click to browse'}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">Any file type up to 10MB each</p>
                  </div>

                  {prescriptionFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {prescriptionFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            <DocumentTextIcon className="w-5 h-5 text-primary-500" />
                            <span className="text-sm font-medium">{file.name}</span>
                            <span className="text-xs text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => viewPrescriptionFile(file)}
                              className="text-xs font-medium text-primary-600 hover:text-primary-700"
                            >
                              View
                            </button>
                            <button onClick={() => removePrescription(index)} className="text-red-500 hover:text-red-600">
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6">
                    <label className="block text-sm font-medium mb-2">Describe your symptoms (optional)</label>
                    <textarea
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      rows={3}
                      className="input"
                      placeholder="Help our pharmacist understand your condition better..."
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 4: Payment */}
              {currentStep === 4 && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card p-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Payment Method</h2>
                  <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                    Wallet balance: ${walletBalance.toFixed(2)}
                  </div>

                  <div className="space-y-4 mb-6">
                    {paymentOptions.map((method) => (
                      <label
                        key={method.id}
                        className={`block p-4 border-2 rounded-xl transition ${
                          paymentMethod === method.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        } ${method.enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                      >
                        <div className="flex items-start">
                          <input
                            type="radio"
                            name="payment"
                            value={method.id}
                            checked={paymentMethod === method.id}
                            onChange={() => {
                              if (method.enabled) setPaymentMethod(method.id);
                            }}
                            disabled={!method.enabled}
                            className="mr-3 mt-1"
                          />
                          <div>
                            <span className="font-medium">{method.label}</span>
                            <p className="text-sm text-gray-500">{method.description}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {paymentMethod === 'wallet' && walletBalance < total && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                      Wallet balance is insufficient for this order total. Add funds in Wallet before placing the order.
                      <button
                        onClick={() => navigate('/wallet')}
                        className="ml-2 font-semibold underline underline-offset-2"
                      >
                        Open Wallet
                      </button>
                    </div>
                  )}

                  {paymentMethod === 'card' && (
                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div>
                        <label className="block text-sm font-medium mb-1">Card Number</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                          placeholder="1234 5678 9012 3456"
                          className="input"
                          disabled
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Expiry</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="input"
                            disabled
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">CVC</label>
                          <input
                            type="text"
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            className="input"
                            disabled
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-not-allowed opacity-60">
                        <input
                          type="checkbox"
                          checked={saveCard}
                          onChange={(e) => setSaveCard(e.target.checked)}
                          className="rounded"
                          disabled
                        />
                        <span className="text-sm">Save card for future purchases</span>
                      </label>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 5: Review */}
              {currentStep === 5 && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card p-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Review Order</h2>

                  {/* Items */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                    <h3 className="font-medium mb-3">Items ({cartItems.length})</h3>
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex justify-between py-2">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">{item.dosageOption.strength}{item.dosageOption.unit} × {item.quantity}</p>
                        </div>
                        <p className="font-medium">${(item.dosageOption.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Address */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                    <h3 className="font-medium mb-2">Delivery Address</h3>
                    {(() => {
                      const addr = addresses.find((a) => a.id === selectedAddressId);
                      return addr ? (
                        <p className="text-gray-600 dark:text-gray-400">
                          {addr.street}, {addr.city}, {addr.state} {addr.zipCode}
                        </p>
                      ) : null;
                    })()}
                  </div>

                  {/* Delivery */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                    <h3 className="font-medium mb-2">Delivery</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {deliveryOption?.name} ({deliveryOption?.time})
                    </p>
                  </div>

                  {/* Payment */}
                  <div>
                    <h3 className="font-medium mb-2">Payment</h3>
                    <p className="text-gray-600 dark:text-gray-400 capitalize">
                      {paymentMethod === 'card' ? `Card ending in ${cardNumber.slice(-4)}` : paymentMethod}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className="btn-ghost disabled:opacity-50"
              >
                Back
              </button>
              {currentStep < 5 ? (
                <button onClick={nextStep} disabled={!canProceed() || cartItems.length === 0} className="btn-primary disabled:opacity-50">
                  Continue
                </button>
              ) : (
                <button onClick={placeOrder} disabled={loading || cartItems.length === 0} className="btn-primary btn-lg">
                  {loading ? 'Processing...' : `Place Order • $${total.toFixed(2)}`}
                </button>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Order Summary</h3>

              <div className="space-y-3 text-sm mb-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {item.name} × {item.quantity}
                    </span>
                    <span>${(item.dosageOption.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Delivery</span>
                  <span className={deliveryFee === 0 ? 'text-green-600' : ''}>
                    {deliveryFee === 0 ? 'FREE' : `$${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                  <span>${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary-600">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
