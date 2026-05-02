import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  CameraIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  CalendarIcon,
  UserIcon,
  PlusIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';

interface Prescription {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  uploadedAt: string;
  expiresAt?: string;
  status: 'verified' | 'pending' | 'expired' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  medicines: string[];
  doctorName?: string;
  hospitalName?: string;
  prescriptionDate?: string;
  usedInOrders: number;
  lastUsedAt?: string;
}

const normalizePrescription = (raw: any): Prescription => ({
  id: raw.id,
  fileName: raw.fileName || 'Prescription',
  fileUrl: raw.imageUrl || raw.filePath || '',
  fileType: raw.fileType?.includes('pdf') ? 'pdf' : 'image',
  uploadedAt: raw.uploadedAt || raw.createdAt || new Date().toISOString(),
  expiresAt: raw.validityDate || raw.validUntil,
  status:
    raw.status === 'approved'
      ? 'verified'
      : raw.status === 'pending'
      ? 'pending'
      : raw.status === 'rejected'
      ? 'rejected'
      : 'expired',
  verifiedBy: raw.verifiedBy,
  verifiedAt: raw.verifiedAt,
  rejectionReason: raw.rejectionReason,
  medicines: raw.medicines || [],
  doctorName: raw.doctorName,
  hospitalName: raw.hospitalName,
  prescriptionDate: raw.issuedDate || raw.prescriptionDate,
  usedInOrders: raw.usedInOrderId ? 1 : 0,
  lastUsedAt: raw.updatedAt,
});

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  verified: { label: 'Verified', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircleIcon },
  pending: { label: 'Pending Review', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: ClockIcon },
  expired: { label: 'Expired', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: ExclamationTriangleIcon },
  rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircleIcon },
};

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [filteredPrescriptions, setFilteredPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [prescriptionToDelete, setPrescriptionToDelete] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Load prescriptions
  useEffect(() => {
    const fetchPrescriptions = async () => {
      try {
        const response = await api.get('/prescriptions');
        const normalized = (response.data.data?.prescriptions || []).map(normalizePrescription);
        setPrescriptions(normalized);
      } catch (error) {
        console.error('Failed to fetch prescriptions:', error);
        setActionError('Unable to load prescriptions right now.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrescriptions();
  }, []);

  // Filter prescriptions
  useEffect(() => {
    let filtered = [...prescriptions];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (rx) =>
          rx.fileName.toLowerCase().includes(query) ||
          rx.medicines.some((m) => m.toLowerCase().includes(query)) ||
          rx.doctorName?.toLowerCase().includes(query) ||
          rx.hospitalName?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((rx) => rx.status === statusFilter);
    }

    filtered.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    setFilteredPrescriptions(filtered);
  }, [prescriptions, searchQuery, statusFilter]);

  // Dropzone config
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.heic', '.heif'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024,
  });

  // Camera capture
  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setUploadedFiles((prev) => [...prev, file]);
      }
    };
    input.click();
  };

  // Remove uploaded file
  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload prescriptions
  const handleUpload = async () => {
    if (uploadedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const formData = new FormData();
        formData.append('prescription', file);

        await api.post('/prescriptions/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              ((i + (progressEvent.loaded / (progressEvent.total || 1))) / uploadedFiles.length) * 100
            );
            setUploadProgress(progress);
          },
        });
      }

      const response = await api.get('/prescriptions');
      const normalized = (response.data.data?.prescriptions || []).map(normalizePrescription);
      setPrescriptions(normalized);

      setUploadedFiles([]);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Upload failed:', error);
      setActionError('Prescription upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Delete prescription
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/prescriptions/${id}`);
      setPrescriptions((prev) => prev.filter((rx) => rx.id !== id));
    } catch (error) {
      console.error('Failed to delete prescription:', error);
      setActionError('Failed to delete prescription.');
    }
  };

  // View prescription
  const handleView = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setShowViewModal(true);
  };

  // Use prescription in order
  const handleUseInOrder = (prescription: Prescription) => {
    localStorage.setItem('selectedPrescription', JSON.stringify(prescription));
    window.location.href = '/medicines';
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get days until expiry
  const getDaysUntilExpiry = (expiresAt: string) => {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Prescriptions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and reuse your prescriptions for faster checkout
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn-primary mt-4 md:mt-0 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Upload Prescription
        </button>
      </div>

      {/* Search and Filters */}
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {actionError}
        </div>
      )}
      <div className="card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by medicine, doctor, or hospital..."
              className="input pl-10 w-full"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden btn-outline flex items-center justify-center gap-2"
          >
            <FunnelIcon className="w-5 h-5" />
            Filters
          </button>

          <div className="hidden md:block">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending Review</option>
              <option value="expired">Expired</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="all">All Status</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending Review</option>
                  <option value="expired">Expired</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Prescriptions Grid */}
      {filteredPrescriptions.length === 0 ? (
        <div className="card p-12 text-center">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No prescriptions found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Upload your first prescription to get started'}
          </p>
          <button onClick={() => setShowUploadModal(true)} className="btn-primary">
            Upload Prescription
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrescriptions.map((prescription) => {
            const status = statusConfig[prescription.status];
            const StatusIcon = status.icon;
            const isUsable = prescription.status === 'verified';
            const daysUntilExpiry = prescription.expiresAt ? getDaysUntilExpiry(prescription.expiresAt) : null;
            const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;

            return (
              <motion.div
                key={prescription.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Preview */}
                <div
                  className="h-32 bg-gray-100 dark:bg-gray-800 relative cursor-pointer"
                  onClick={() => handleView(prescription)}
                >
                  {prescription.fileType === 'pdf' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <DocumentTextIcon className="w-16 h-16 text-red-400" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PhotoIcon className="w-16 h-16 text-blue-400" />
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                    <StatusIcon className="w-3 h-3 inline mr-1" />
                    {status.label}
                  </div>

                  {/* Expiring Soon Warning */}
                  {isExpiringSoon && (
                    <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                      Expires in {daysUntilExpiry} days
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Medicines */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                      {prescription.medicines.join(', ')}
                    </h3>
                    {prescription.doctorName && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <UserIcon className="w-4 h-4" />
                        {prescription.doctorName}
                      </p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      Uploaded {formatDate(prescription.uploadedAt)}
                    </span>
                    {prescription.usedInOrders > 0 && (
                      <span>Used {prescription.usedInOrders}×</span>
                    )}
                  </div>

                  {/* Rejection Reason */}
                  {prescription.status === 'rejected' && prescription.rejectionReason && (
                    <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2">
                        {prescription.rejectionReason}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleView(prescription)}
                      className="btn-ghost text-sm flex-1 flex items-center justify-center gap-1"
                    >
                      <EyeIcon className="w-4 h-4" />
                      View
                    </button>
                    {isUsable && (
                      <button
                        onClick={() => handleUseInOrder(prescription)}
                        className="btn-primary text-sm flex-1 flex items-center justify-center gap-1"
                      >
                        <ArrowPathIcon className="w-4 h-4" />
                        Use
                      </button>
                    )}
                    <button
                      onClick={() => setPrescriptionToDelete(prescription.id)}
                      className="btn-ghost text-sm text-red-600 hover:text-red-700 p-2"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {prescriptions.length > 0 && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{prescriptions.length}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {prescriptions.filter((rx) => rx.status === 'verified').length}
            </p>
            <p className="text-sm text-gray-500">Verified</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {prescriptions.filter((rx) => rx.status === 'pending').length}
            </p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">
              {prescriptions.filter((rx) => rx.status === 'expired').length}
            </p>
            <p className="text-sm text-gray-500">Expired</p>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !isUploading && setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upload Prescription</h2>
                <button
                  onClick={() => !isUploading && setShowUploadModal(false)}
                  disabled={isUploading}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                }`}
              >
                <input {...getInputProps()} />
                <CloudArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  {isDragActive ? 'Drop files here' : 'Drag & drop prescription files here'}
                </p>
                <p className="text-sm text-gray-400">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">
                  Supports: PDF, JPG, PNG, HEIC (Max 10MB each)
                </p>
              </div>

              {/* Camera Capture Button */}
              <button
                onClick={handleCameraCapture}
                className="mt-4 w-full btn-outline flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-5 h-5" />
                Take Photo
              </button>

              {/* Uploaded Files Preview */}
              {uploadedFiles.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Files to upload ({uploadedFiles.length})
                  </h3>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          {file.type.includes('pdf') ? (
                            <DocumentTextIcon className="w-8 h-8 text-red-400" />
                          ) : (
                            <PhotoIcon className="w-8 h-8 text-blue-400" />
                          )}
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[200px]">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeUploadedFile(index)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                    <span className="text-primary-600">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      className="h-full bg-primary-600"
                    />
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={uploadedFiles.length === 0 || isUploading}
                className="mt-6 w-full btn-primary"
              >
                {isUploading ? 'Uploading...' : `Upload ${uploadedFiles.length} File${uploadedFiles.length !== 1 ? 's' : ''}`}
              </button>

              {/* Tips */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Tips for faster verification:</h4>
                <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                  <li>• Ensure all text is clearly visible</li>
                  <li>• Include the doctor&apos;s name and signature</li>
                  <li>• Make sure the prescription date is visible</li>
                  <li>• Prescriptions must be less than 6 months old</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Prescription Modal */}
      <AnimatePresence>
        {showViewModal && selectedPrescription && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowViewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Prescription Details</h2>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Preview */}
                <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-xl mb-6 flex items-center justify-center">
                  {selectedPrescription.fileType === 'pdf' ? (
                    <div className="text-center">
                      <DocumentTextIcon className="w-20 h-20 text-red-400 mx-auto mb-2" />
                      
                        <a href={selectedPrescription.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline">
                          
                        Open PDF
                      </a>
                    </div>
                  ) : (
                    <div className="text-center">
                      <PhotoIcon className="w-20 h-20 text-blue-400 mx-auto" />
                      <p className="text-gray-500 mt-2">Image preview</p>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className={`p-4 rounded-xl mb-6 ${statusConfig[selectedPrescription.status].bgColor}`}>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const StatusIcon = statusConfig[selectedPrescription.status].icon;
                      return <StatusIcon className={`w-6 h-6 ${statusConfig[selectedPrescription.status].color}`} />;
                    })()}
                    <div>
                      <p className={`font-medium ${statusConfig[selectedPrescription.status].color}`}>
                        {statusConfig[selectedPrescription.status].label}
                      </p>
                      {selectedPrescription.verifiedBy && selectedPrescription.verifiedAt && (
                        <p className="text-sm text-gray-500">
                          Verified by {selectedPrescription.verifiedBy} on {formatDate(selectedPrescription.verifiedAt)}
                        </p>
                      )}
                      {selectedPrescription.rejectionReason && (
                        <p className="text-sm text-red-600 mt-1">{selectedPrescription.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">Medicines</label>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPrescription.medicines.join(', ')}
                    </p>
                  </div>

                  {selectedPrescription.doctorName && (
                    <div>
                      <label className="text-sm text-gray-500">Prescribing Doctor</label>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedPrescription.doctorName}</p>
                    </div>
                  )}

                  {selectedPrescription.hospitalName && (
                    <div>
                      <label className="text-sm text-gray-500">Hospital/Clinic</label>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedPrescription.hospitalName}</p>
                    </div>
                  )}

                  {selectedPrescription.prescriptionDate && (
                    <div>
                      <label className="text-sm text-gray-500">Prescription Date</label>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDate(selectedPrescription.prescriptionDate)}
                      </p>
                    </div>
                  )}

                  {selectedPrescription.expiresAt && (
                    <div>
                      <label className="text-sm text-gray-500">Valid Until</label>
                      <p className={`font-medium ${
                        selectedPrescription.status === 'expired' ? 'text-red-600' : 'text-gray-900 dark:text-white'
                      }`}>
                        {formatDate(selectedPrescription.expiresAt)}
                        {selectedPrescription.status !== 'expired' && (
                          <span className="text-sm text-gray-500 ml-2">
                            ({getDaysUntilExpiry(selectedPrescription.expiresAt)} days remaining)
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm text-gray-500">Upload Date</label>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatDate(selectedPrescription.uploadedAt)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">Usage History</label>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Used in {selectedPrescription.usedInOrders} order{selectedPrescription.usedInOrders !== 1 ? 's' : ''}
                      {selectedPrescription.lastUsedAt && (
                        <span className="text-sm text-gray-500 ml-2">
                          (last used {formatDate(selectedPrescription.lastUsedAt)})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                {selectedPrescription.status === 'verified' && (
                  <button
                    onClick={() => {
                      handleUseInOrder(selectedPrescription);
                      setShowViewModal(false);
                    }}
                    className="btn-primary flex-1"
                  >
                    Use for Order
                  </button>
                )}
                <button
                  onClick={() => {
                    setPrescriptionToDelete(selectedPrescription.id);
                    setShowViewModal(false);
                  }}
                  className="btn bg-red-100 text-red-700 hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!prescriptionToDelete}
        title="Delete prescription?"
        message="Deleting this file cannot be undone."
        confirmLabel="Delete"
        isDestructive
        onCancel={() => setPrescriptionToDelete(null)}
        onConfirm={async () => {
          if (!prescriptionToDelete) return;
          await handleDelete(prescriptionToDelete);
          setPrescriptionToDelete(null);
        }}
      />
    </div>
  );
}