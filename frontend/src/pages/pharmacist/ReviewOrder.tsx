import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  ArrowTrendingUpIcon,
  PencilSquareIcon,
  ClockIcon,
  UserIcon,
  BeakerIcon,
  ShieldExclamationIcon,
  HeartIcon,
  InformationCircleIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
  CheckIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import api from '../../services/api';

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  quantity: number;
  price: number;
  requiresRx: boolean;
  isControlled: boolean;
  instructions?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

interface PatientMedicalInfo {
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  bloodType?: string;
  age?: number;
  gender?: string;
}

interface DrugInteraction {
  severity: 'mild' | 'moderate' | 'severe';
  drug1: string;
  drug2: string;
  description: string;
  recommendation: string;
}

interface PrescriptionImage {
  id: string;
  url: string;
  uploadedAt: string;
  fileType?: string;
  fileName?: string;
}

function isPrescriptionPdf(img: PrescriptionImage): boolean {
  const ft = (img.fileType || '').toLowerCase();
  if (ft.includes('pdf')) return true;
  const path = (img.fileName || img.url || '').toLowerCase().split('?')[0];
  return path.endsWith('.pdf');
}

interface ChatMessage {
  id: string;
  sender: 'pharmacist' | 'patient';
  message: string;
  timestamp: string;
}

interface ReviewHistory {
  id: string;
  action: string;
  note?: string;
  performedBy: string;
  timestamp: string;
}

interface Order {
  id: string;
  orderNumber: string;
  patientId: string; // Anonymous ID like "Patient #A7X9K2"
  medicines: Medicine[];
  prescriptionImages: PrescriptionImage[];
  patientMedicalInfo: PatientMedicalInfo;
  drugInteractions: DrugInteraction[];
  priority: 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'info_requested' | 'modified' | 'escalated';
  waitTime: number;
  createdAt: string;
  deliveryType: string;
  deliveryAddress: string;
  subtotal: number;
  total: number;
  symptomsDescription?: string;
  previousOrders: number;
  isFirstOrder: boolean;
  reviewHistory: ReviewHistory[];
  assignedTo?: string;
  escalatedTo?: string;
  infoRequestMessage?: string;
  patientResponse?: string;
}

const severityConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  mild: { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Mild' },
  moderate: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Moderate' },
  severe: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Severe' },
};

// Demo data
const demoOrder: Order = {
  id: '1',
  orderNumber: 'JM-2024-001260',
  patientId: 'Patient #A7X9K2',
  medicines: [
    {
      id: 'm1',
      name: 'Amoxicillin',
      genericName: 'Amoxicillin Trihydrate',
      dosage: '500mg',
      quantity: 21,
      price: 15.99,
      requiresRx: true,
      isControlled: false,
      instructions: 'Take 1 capsule 3 times daily for 7 days',
      reviewStatus: 'pending',
    },
    {
      id: 'm2',
      name: 'Ibuprofen',
      genericName: 'Ibuprofen',
      dosage: '400mg',
      quantity: 30,
      price: 8.99,
      requiresRx: false,
      isControlled: false,
      instructions: 'Take 1 tablet every 6 hours as needed for pain',
      reviewStatus: 'pending',
    },
  ],
  prescriptionImages: [
    { id: 'p1', url: '/rx/prescription-1.jpg', uploadedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  ],
  patientMedicalInfo: {
    allergies: ['Penicillin', 'Sulfa drugs'],
    chronicConditions: ['Asthma'],
    currentMedications: ['Albuterol inhaler', 'Vitamin D'],
    bloodType: 'O+',
    age: 34,
    gender: 'Female',
  },
  drugInteractions: [
    {
      severity: 'severe',
      drug1: 'Amoxicillin',
      drug2: 'Patient Allergy (Penicillin)',
      description: 'Amoxicillin is a penicillin-type antibiotic. Patient has documented Penicillin allergy.',
      recommendation: 'DO NOT DISPENSE. Contact prescribing physician for alternative antibiotic (e.g., Azithromycin, Fluoroquinolones).',
    },
  ],
  priority: 'urgent',
  status: 'in_review',
  waitTime: 28,
  createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
  deliveryType: 'Express (30-60 min)',
  deliveryAddress: 'New York, NY 10001',
  subtotal: 24.98,
  total: 32.96,
  symptomsDescription: 'Sore throat and fever for 3 days. Doctor prescribed amoxicillin for suspected bacterial infection.',
  previousOrders: 5,
  isFirstOrder: false,
  reviewHistory: [
    {
      id: 'h1',
      action: 'Order Received',
      performedBy: 'System',
      timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    },
    {
      id: 'h2',
      action: 'Review Started',
      performedBy: 'Dr. Sarah M.',
      timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
  ],
};

const quickRejectionReasons = [
  'Prescription expired (older than 6 months)',
  'Prescription image is unclear or unreadable',
  'Prescription appears to be altered or invalid',
  'Dosage exceeds maximum recommended amount',
  'Missing prescriber information or signature',
  'Controlled substance requires original prescription',
  'Drug interaction with patient allergies',
  'Other (specify in notes)',
];

const quickInfoRequests = [
  'Please provide a clearer image of the prescription',
  'Please confirm the dosage with your prescribing doctor',
  'Please upload a more recent prescription (within 6 months)',
  'Please provide prescriber contact information for verification',
  'Please confirm this medication is for you',
];

export default function PharmacistReviewOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'prescription' | 'patient' | 'interactions' | 'history'>('prescription');
  
  // Prescription viewer state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [prescriptionMediaError, setPrescriptionMediaError] = useState(false);

  // Action modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showInfoRequestModal, setShowInfoRequestModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [actionError, setActionError] = useState('');

  // Form state
  const [rejectionReason, setRejectionReason] = useState('');
  const [infoRequestMessage, setInfoRequestMessage] = useState('');
  const [escalationNote, setEscalationNote] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'patient',
      message: 'Hi, I uploaded my prescription. Please let me know if you need anything else.',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const mapApiOrderToReviewOrder = (apiOrder: any, prescriptions: any[] = []): Order => {
    const orderItems = apiOrder?.orderItems || apiOrder?.items || [];
    const medicines: Medicine[] = orderItems.map((item: any, index: number) => {
      const dosage =
        item?.medicine?.dosageOptions?.find?.((d: any) => d.id === item.dosageOptionId) ||
        item?.medicine?.dosageOptions?.[0];
      return {
        id: item?.id || `medicine-${index}`,
        name: item?.medicine?.name || 'Unknown medicine',
        genericName: item?.medicine?.genericName || '',
        dosage: dosage ? `${dosage.strength}${dosage.unit}` : '',
        quantity: item?.quantity || 0,
        price: Number(item?.totalPrice || item?.unitPrice || 0),
        requiresRx: !!item?.prescriptionRequired,
        isControlled: item?.medicine?.prescriptionRequirement === 'controlled_substance',
        reviewStatus: 'pending',
      };
    });

    return {
      id: apiOrder?.id || '',
      orderNumber: apiOrder?.orderNumber || 'Unknown',
      patientId: apiOrder?.userId ? `Patient #${String(apiOrder.userId).slice(0, 6).toUpperCase()}` : 'Patient',
      medicines,
      prescriptionImages: (prescriptions || [])
        .map((p: any, index: number) => ({
          id: p?.id || `prescription-${index}`,
          url: p?.imageUrl || '',
          uploadedAt: p?.uploadedAt || p?.createdAt || new Date().toISOString(),
          fileType: p?.fileType,
          fileName: p?.fileName,
        }))
        .filter((img: PrescriptionImage) => !!img.url),
      patientMedicalInfo: {
        allergies: apiOrder?.user?.medicalInfo?.allergies || [],
        chronicConditions: apiOrder?.user?.medicalInfo?.chronicConditions || [],
        currentMedications: apiOrder?.user?.medicalInfo?.currentMedications || [],
        bloodType: apiOrder?.user?.medicalInfo?.bloodType,
        age: apiOrder?.user?.profile?.age,
        gender: apiOrder?.user?.profile?.gender,
      },
      drugInteractions: [],
      priority: apiOrder?.urgencyLevel === 'emergency' ? 'urgent' : apiOrder?.urgencyLevel === 'urgent' ? 'high' : 'normal',
      status: 'in_review',
      waitTime: Math.max(0, Math.floor((Date.now() - new Date(apiOrder?.createdAt || Date.now()).getTime()) / 60000)),
      createdAt: apiOrder?.createdAt || new Date().toISOString(),
      deliveryType: apiOrder?.deliveryType || 'standard',
      deliveryAddress: apiOrder?.deliveryAddress
        ? `${apiOrder.deliveryAddress.streetAddress || ''}, ${apiOrder.deliveryAddress.city || ''}`
        : 'Address unavailable',
      subtotal: Number(apiOrder?.subtotal || 0),
      total: Number(apiOrder?.totalAmount || 0),
      symptomsDescription: apiOrder?.symptomsDescription || undefined,
      previousOrders: 0,
      isFirstOrder: false,
      reviewHistory: [
        {
          id: 'history-created',
          action: 'Order received',
          performedBy: 'System',
          timestamp: apiOrder?.createdAt || new Date().toISOString(),
        },
      ],
    };
  };

  // Fetch order
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        if (!orderId) return;
        const response = await api.get(`/pharmacist/order/${orderId}`);
        const apiData = response.data?.data;
        setOrder(mapApiOrderToReviewOrder(apiData?.order, apiData?.prescriptions));
        const chatResponse = await api.get(`/communication/chat/${orderId}`).catch(() => null);
        const chat = chatResponse?.data?.data?.messages || [];
        setChatMessages(
          chat.map((msg: any) => ({
            id: msg.id || String(Date.now()),
            sender: msg.senderId === apiData?.order?.userId ? 'patient' : 'pharmacist',
            message: msg.message || '',
            timestamp: msg.timestamp || new Date().toISOString(),
          }))
        );
      } catch (error) {
        console.error('Failed to fetch order:', error);
        setOrder(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    setPrescriptionMediaError(false);
    setCurrentImageIndex(0);
  }, [order?.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Image navigation
  const nextImage = () => {
    if (order && currentImageIndex < order.prescriptionImages.length - 1) {
      setCurrentImageIndex((prev) => prev + 1);
      setZoomLevel(1);
      setRotation(0);
      setPrescriptionMediaError(false);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex((prev) => prev - 1);
      setZoomLevel(1);
      setRotation(0);
      setPrescriptionMediaError(false);
    }
  };

  // Zoom and rotate
  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const rotate = () => setRotation((prev) => (prev + 90) % 360);
  const resetView = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  // Review actions
  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      setActionError('');
      if (!orderId) return;
      await api.post(`/pharmacist/order/${orderId}/approve`, { notes: approvalNote });
      navigate('/pharmacist/queue');
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason) {
      setActionError('Please provide a rejection reason.');
      return;
    }
    setIsSubmitting(true);
    try {
      setActionError('');
      if (!orderId) return;
      await api.post(`/pharmacist/order/${orderId}/reject`, { reason: rejectionReason });
      setShowRejectModal(false);
      navigate('/pharmacist/queue');
    } catch (error) {
      console.error('Failed to reject:', error);
      setActionError('Failed to reject order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!infoRequestMessage) {
      setActionError('Please provide a message for the patient.');
      return;
    }
    setIsSubmitting(true);
    try {
      setActionError('');
      if (!orderId) return;
      await api.post(`/pharmacist/order/${orderId}/request-info`, { message: infoRequestMessage });
      setShowInfoRequestModal(false);
      navigate('/pharmacist/queue');
    } catch (error) {
      console.error('Failed to request info:', error);
      setActionError('Failed to send info request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    setIsSubmitting(true);
    try {
      setActionError('');
      if (!orderId) return;
      await api.post(`/pharmacist/order/${orderId}/escalate`, { note: escalationNote });
      setShowEscalateModal(false);
      navigate('/pharmacist/queue');
    } catch (error) {
      console.error('Failed to escalate:', error);
      setActionError('Failed to escalate order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve/Reject individual item
  const handleItemAction = async (medicineId: string, action: 'approve' | 'reject', reason?: string) => {
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        medicines: prev.medicines.map((m) =>
          m.id === medicineId
            ? { ...m, reviewStatus: action === 'approve' ? 'approved' : 'rejected', rejectionReason: reason }
            : m
        ),
      };
    });
  };

  // Send chat message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      if (!orderId) return;
      const response = await api.post('/communication/chat/send', {
        orderId,
        message: newMessage,
        type: 'text',
      });
      const sent = response.data?.data?.message;
      setChatMessages([
        ...chatMessages,
        {
          id: sent?.id || Date.now().toString(),
          sender: 'pharmacist',
          message: sent?.message || newMessage,
          timestamp: sent?.timestamp || new Date().toISOString(),
        },
      ]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Start VoIP call
  const startCall = async (video: boolean = false) => {
    try {
      if (!orderId) return;
      await api.post('/communication/call/initiate', {
        orderId,
        type: video ? 'video' : 'audio',
      });
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Order not found</h1>
        <button onClick={() => navigate('/pharmacist/queue')} className="btn-primary">
          Back to Queue
        </button>
      </div>
    );
  }

  const hasInteractions = order.drugInteractions.length > 0;
  const hasSevereInteraction = order.drugInteractions.some((i) => i.severity === 'severe');
  const allItemsReviewed = order.medicines.every((m) => m.reviewStatus !== 'pending');
  const hasRejectedItems = order.medicines.some((m) => m.reviewStatus === 'rejected');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pharmacist/queue')}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{order.orderNumber}</h1>
              {order.priority === 'urgent' && (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium animate-pulse">
                  URGENT
                </span>
              )}
              {order.priority === 'high' && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                  HIGH PRIORITY
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {order.patientId} • Waiting {order.waitTime} min • {order.deliveryType}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <button
            onClick={() => setShowChatModal(true)}
            className="btn-outline flex items-center gap-2"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
            Chat
          </button>
          <button
            onClick={() => startCall(false)}
            className="btn-outline flex items-center gap-2"
          >
            <PhoneIcon className="w-5 h-5" />
            Call
          </button>
        </div>
      </div>

      {/* Drug Interaction Alert */}
      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {hasSevereInteraction && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-700 dark:text-red-300">SEVERE DRUG INTERACTION DETECTED</h3>
              {order.drugInteractions
                .filter((i) => i.severity === 'severe')
                .map((interaction, idx) => (
                  <div key={idx} className="mt-2">
                    <p className="text-red-600 dark:text-red-400">{interaction.description}</p>
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1 font-medium">
                      Recommendation: {interaction.recommendation}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Prescription Viewer */}
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-white">Prescription Images</h2>
              <div className="flex items-center gap-2">
                <button onClick={zoomOut} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Zoom Out">
                  <MagnifyingGlassMinusIcon className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-500">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={zoomIn} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Zoom In">
                  <MagnifyingGlassPlusIcon className="w-5 h-5" />
                </button>
                <button onClick={rotate} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Rotate">
                  <ArrowPathIcon className="w-5 h-5" />
                </button>
                <button onClick={resetView} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Reset">
                  <ArrowsPointingOutIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image Viewer */}
            <div className="relative h-[400px] bg-gray-100 dark:bg-gray-800 overflow-hidden">
              {order.prescriptionImages.length > 0 ? (
                <>
                  <div
                    className="w-full h-full flex items-center justify-center overflow-auto"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    {(() => {
                      const current = order.prescriptionImages[currentImageIndex];
                      if (!current?.url) return null;
                      const showPdf = isPrescriptionPdf(current);
                      if (prescriptionMediaError) {
                        return (
                          <div className="text-center p-8 max-w-md">
                            <PhotoIcon className="w-16 h-16 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">Could not load preview in the page.</p>
                            <a
                              href={current.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:underline text-sm font-medium"
                            >
                              Open prescription in new tab
                            </a>
                          </div>
                        );
                      }
                      if (showPdf) {
                        return (
                          <iframe
                            title="Prescription document"
                            src={current.url}
                            className="h-full w-full min-h-[360px] border-0 bg-white"
                            onError={() => setPrescriptionMediaError(true)}
                          />
                        );
                      }
                      return (
                        <img
                          src={current.url}
                          alt={current.fileName || `Prescription ${currentImageIndex + 1}`}
                          className="max-h-[380px] max-w-full object-contain shadow-sm"
                          onError={() => setPrescriptionMediaError(true)}
                        />
                      );
                    })()}
                  </div>
                  {order.prescriptionImages[currentImageIndex]?.url && (
                    <a
                      href={order.prescriptionImages[currentImageIndex].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 right-3 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/70"
                    >
                      Open full size
                    </a>
                  )}

                  {/* Navigation */}
                  {order.prescriptionImages.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        disabled={currentImageIndex === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full disabled:opacity-30"
                      >
                        <ChevronLeftIcon className="w-6 h-6" />
                      </button>
                      <button
                        onClick={nextImage}
                        disabled={currentImageIndex === order.prescriptionImages.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full disabled:opacity-30"
                      >
                        <ChevronRightIcon className="w-6 h-6" />
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white text-sm rounded-full">
                        {currentImageIndex + 1} / {order.prescriptionImages.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">No prescription images</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Symptoms Description */}
          {order.symptomsDescription && (
            <div className="card p-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Patient Description</h3>
              <p className="text-gray-600 dark:text-gray-300 italic">&quot;{order.symptomsDescription}&quot;</p>
            </div>
          )}

          {/* Patient Response (if info was requested) */}
          {order.patientResponse && (
            <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-2">Patient Response</h3>
              <p className="text-blue-600 dark:text-blue-400">{order.patientResponse}</p>
            </div>
          )}
        </div>

        {/* Right Column - Order Details & Actions */}
        <div className="space-y-6">
          {/* Tabs */}
          <div className="card">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {[
                { id: 'prescription', label: 'Medicines', icon: BeakerIcon },
                { id: 'patient', label: 'Patient', icon: UserIcon },
                { id: 'interactions', label: 'Interactions', icon: ExclamationTriangleIcon, badge: hasInteractions },
                { id: 'history', label: 'History', icon: ClockIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary-600 border-b-2 border-primary-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.badge && (
                    <span className={`w-2 h-2 rounded-full ${
                      hasSevereInteraction ? 'bg-red-500' : 'bg-orange-500'
                    }`} />
                  )}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* Medicines Tab */}
              {activeTab === 'prescription' && (
                <div className="space-y-4">
                  {order.medicines.map((medicine) => (
                    <div
                      key={medicine.id}
                      className={`p-4 rounded-xl border-2 ${
                        medicine.reviewStatus === 'approved'
                          ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                          : medicine.reviewStatus === 'rejected'
                          ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{medicine.name}</h4>
                            {medicine.requiresRx && (
                              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs">Rx</span>
                            )}
                            {medicine.isControlled && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs flex items-center gap-1">
                                <ShieldExclamationIcon className="w-3 h-3" />
                                Controlled
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{medicine.genericName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {medicine.dosage} × {medicine.quantity} units
                          </p>
                          {medicine.instructions && (
                            <p className="text-sm text-gray-500 mt-1 italic">{medicine.instructions}</p>
                          )}
                          <p className="text-sm font-medium text-primary-600 mt-2">${medicine.price.toFixed(2)}</p>
                        </div>

                        {/* Item Actions */}
                        {medicine.reviewStatus === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleItemAction(medicine.id, 'approve')}
                              className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                              title="Approve Item"
                            >
                              <CheckIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleItemAction(medicine.id, 'reject', 'Item rejected')}
                              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                              title="Reject Item"
                            >
                              <NoSymbolIcon className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            medicine.reviewStatus === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {medicine.reviewStatus === 'approved' ? 'Approved' : 'Rejected'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Order Total */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span>${order.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold mt-2">
                      <span>Total</span>
                      <span className="text-primary-600">${order.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Tab */}
              {activeTab === 'patient' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <UserIcon className="w-8 h-8 text-gray-400" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{order.patientId}</p>
                      <p className="text-sm text-gray-500">
                        {order.patientMedicalInfo.age && `${order.patientMedicalInfo.age} years`}
                        {order.patientMedicalInfo.gender && ` • ${order.patientMedicalInfo.gender}`}
                        {order.patientMedicalInfo.bloodType && ` • Blood Type: ${order.patientMedicalInfo.bloodType}`}
                      </p>
                      <p className="text-sm text-gray-500">{order.previousOrders} previous orders</p>
                    </div>
                  </div>

                  {/* Allergies */}
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                      Allergies
                    </h4>
                    {order.patientMedicalInfo.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {order.patientMedicalInfo.allergies.map((allergy, idx) => (
                          <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                            {allergy}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No known allergies</p>
                    )}
                  </div>

                  {/* Chronic Conditions */}
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <HeartIcon className="w-4 h-4 text-orange-500" />
                      Chronic Conditions
                    </h4>
                    {order.patientMedicalInfo.chronicConditions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {order.patientMedicalInfo.chronicConditions.map((condition, idx) => (
                          <span key={idx} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                            {condition}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No chronic conditions reported</p>
                    )}
                  </div>

                  {/* Current Medications */}
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <BeakerIcon className="w-4 h-4 text-blue-500" />
                      Current Medications
                    </h4>
                    {order.patientMedicalInfo.currentMedications.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {order.patientMedicalInfo.currentMedications.map((med, idx) => (
                          <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                            {med}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No current medications reported</p>
                    )}
                  </div>
                </div>
              )}

              {/* Interactions Tab */}
              {activeTab === 'interactions' && (
                <div className="space-y-4">
                  {order.drugInteractions.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircleSolid className="w-12 h-12 mx-auto text-green-500 mb-2" />
                      <p className="text-green-600 font-medium">No drug interactions detected</p>
                    </div>
                  ) : (
                    order.drugInteractions.map((interaction, idx) => {
                      const config = severityConfig[interaction.severity];
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border-2 ${config.bgColor} ${
                            interaction.severity === 'severe' ? 'border-red-300' : 'border-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <ExclamationTriangleIcon className={`w-6 h-6 ${config.color} flex-shrink-0`} />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-bold ${config.color}`}>{config.label} Interaction</span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-medium">{interaction.drug1}</span>
                                {' ↔ '}
                                <span className="font-medium">{interaction.drug2}</span>
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{interaction.description}</p>
                              <p className={`text-sm font-medium mt-2 ${config.color}`}>
                                {interaction.recommendation}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {order.reviewHistory.map((event, idx) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          idx === order.reviewHistory.length - 1 ? 'bg-primary-600' : 'bg-gray-300'
                        }`} />
                        {idx < order.reviewHistory.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 my-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900 dark:text-white">{event.action}</h4>
                          <span className="text-xs text-gray-500">{formatTime(event.timestamp)}</span>
                        </div>
                        <p className="text-sm text-gray-500">by {event.performedBy}</p>
                        {event.note && <p className="text-sm text-gray-600 mt-1">{event.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Approval Note */}
          <div className="card p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Review Notes (Optional)
            </label>
            <textarea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder="Add any notes about this review..."
              className="input min-h-[80px]"
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="card p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={handleApprove}
                disabled={isSubmitting || hasSevereInteraction}
                className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircleIcon className="w-5 h-5" />
                Approve
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isSubmitting}
                className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <XCircleIcon className="w-5 h-5" />
                Reject
              </button>
              <button
                onClick={() => setShowInfoRequestModal(true)}
                disabled={isSubmitting}
                className="btn-outline flex items-center justify-center gap-2"
              >
                <InformationCircleIcon className="w-5 h-5" />
                Request Info
              </button>
              <button
                onClick={() => setShowEscalateModal(true)}
                disabled={isSubmitting}
                className="btn-outline flex items-center justify-center gap-2"
              >
                <ArrowTrendingUpIcon className="w-5 h-5" />
                Escalate
              </button>
            </div>

            {hasSevereInteraction && (
              <p className="text-sm text-red-600 mt-3 text-center">
                Cannot approve due to severe drug interaction. Please reject or escalate.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Reject Order</h3>

              <div className="space-y-3 mb-4">
                <p className="text-sm text-gray-500">Select a reason:</p>
                {quickRejectionReasons.map((reason, idx) => (
                  <button
                    key={idx}
                    onClick={() => setRejectionReason(reason)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                      rejectionReason === reason
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-sm">{reason}</span>
                  </button>
                ))}
              </div>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Or enter custom reason..."
                className="input min-h-[80px] mb-4"
                rows={3}
              />

              <div className="flex gap-3">
                <button onClick={() => setShowRejectModal(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectionReason || isSubmitting}
                  className="btn bg-red-600 text-white hover:bg-red-700 flex-1 disabled:opacity-50"
                >
                  {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Request Modal */}
      <AnimatePresence>
        {showInfoRequestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowInfoRequestModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Request More Information</h3>

              <div className="space-y-3 mb-4">
                <p className="text-sm text-gray-500">Select a message:</p>
                {quickInfoRequests.map((msg, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInfoRequestMessage(msg)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                      infoRequestMessage === msg
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-sm">{msg}</span>
                  </button>
                ))}
              </div>

              <textarea
                value={infoRequestMessage}
                onChange={(e) => setInfoRequestMessage(e.target.value)}
                placeholder="Or enter custom message..."
                className="input min-h-[80px] mb-4"
                rows={3}
              />

              <div className="flex gap-3">
                <button onClick={() => setShowInfoRequestModal(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleRequestInfo}
                  disabled={!infoRequestMessage || isSubmitting}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Escalate Modal */}
      <AnimatePresence>
        {showEscalateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowEscalateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Escalate to Senior Pharmacist</h3>
              <p className="text-sm text-gray-500 mb-4">
                This order will be transferred to a senior pharmacist for review.
              </p>

              <textarea
                value={escalationNote}
                onChange={(e) => setEscalationNote(e.target.value)}
                placeholder="Reason for escalation (optional but recommended)..."
                className="input min-h-[100px] mb-4"
                rows={4}
              />

              <div className="flex gap-3">
                <button onClick={() => setShowEscalateModal(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleEscalate}
                  disabled={isSubmitting}
                  className="btn bg-orange-600 text-white hover:bg-orange-700 flex-1 disabled:opacity-50"
                >
                  {isSubmitting ? 'Escalating...' : 'Confirm Escalation'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {showChatModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
            onClick={() => setShowChatModal(false)}
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
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{order.patientId}</p>
                    <p className="text-xs text-gray-500">Anonymous Patient Chat</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startCall(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <PhoneIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => startCall(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <VideoCameraIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowChatModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <p className="text-center text-xs text-gray-400 mb-4">
                  Patient identity is anonymized for privacy
                </p>
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'pharmacist' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl ${
                        msg.sender === 'pharmacist'
                          ? 'bg-primary-600 text-white rounded-br-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.sender === 'pharmacist' ? 'text-primary-200' : 'text-gray-400'}`}>
                        {formatTime(msg.timestamp)}
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
    </div>
  );
}
