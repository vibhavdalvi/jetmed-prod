import { useState, useEffect, useCallback } from 'react';
import {
  Pill, Search, Plus, ChevronLeft, ChevronRight, Download,
  Eye, Edit, Trash2, X, CheckCircle, AlertTriangle, Package,
  Save, MoreVertical
} from 'lucide-react';
import api from '../../services/api';

interface DosageOption {
  id: string;
  strength: string;
  unit: string;
  price: number;
  stripSize?: number;
}

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  slug: string;
  category: string;
  type: string;
  prescriptionRequirement: 'otc' | 'prescription_required' | 'controlled_substance';
  manufacturer?: string;
  description?: string;
  dosageOptions: DosageOption[];
  images: string[];
  isActive: boolean;
  createdAt: string;
  _count?: {
    inventoryItems: number;
    orderItems: number;
  };
}

const categories = [
  'Pain Relief', 'Antibiotics', 'Cardiovascular', 'Diabetes', 'Respiratory',
  'Gastrointestinal', 'Vitamins & Supplements', 'Skin Care', 'Eye Care',
  'Mental Health', 'Allergies', 'Hormones', 'First Aid', 'Other'
];

const prescriptionTypes = [
  { value: 'otc', label: 'Over the Counter (OTC)', color: 'bg-green-100 text-green-700' },
  { value: 'prescription_required', label: 'Prescription Required', color: 'bg-orange-100 text-orange-700' },
  { value: 'controlled_substance', label: 'Controlled Substance', color: 'bg-red-100 text-red-700' },
];

export default function ManageMedicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMedicines, setTotalMedicines] = useState(0);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const [editForm, setEditForm] = useState<{
    name: string;
    genericName: string;
    category: string;
    type: string;
    prescriptionRequirement: string;
    manufacturer: string;
    description: string;
    dosageOptions: DosageOption[];
    isActive: boolean;
  }>({
    name: '',
    genericName: '',
    category: '',
    type: 'tablet',
    prescriptionRequirement: 'otc',
    manufacturer: '',
    description: '',
    dosageOptions: [{ id: '1', strength: '', unit: 'mg', price: 0 }],
    isActive: true,
  });

  const fetchMedicines = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });

      const response = await api.get(`/admin/medicines?${params}`);
      const data = response.data?.data;

      setMedicines(data?.medicines || []);
      setTotalPages(data?.totalPages || 1);
      setTotalMedicines(data?.total || 0);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
      setMedicines([]);
      setTotalPages(1);
      setTotalMedicines(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  const handleToggleStatus = async (medicine: Medicine) => {
    try {
      setActionLoading(true);
      setActionError('');
      await api.patch(`/admin/medicines/${medicine.id}`, { isActive: !medicine.isActive });
      setActiveDropdown(null);
      fetchMedicines();
    } catch (error) {
      console.error('Failed to update medicine status:', error);
      setActionError('Failed to update medicine status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMedicine) return;
    try {
      setActionLoading(true);
      setActionError('');
      await api.delete(`/medicines/${selectedMedicine.id}`);
      setShowDeleteModal(false);
      setSelectedMedicine(null);
      fetchMedicines();
    } catch (error) {
      console.error('Failed to delete medicine:', error);
      setActionError('Failed to delete medicine');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setEditForm({
      name: medicine.name,
      genericName: medicine.genericName,
      category: medicine.category,
      type: medicine.type,
      prescriptionRequirement: medicine.prescriptionRequirement,
      manufacturer: medicine.manufacturer || '',
      description: medicine.description || '',
      dosageOptions: medicine.dosageOptions.length > 0 ? medicine.dosageOptions : [{ id: '1', strength: '', unit: 'mg', price: 0 }],
      isActive: medicine.isActive,
    });
    setShowEditModal(true);
    setActiveDropdown(null);
  };

  const handleSave = async () => {
    try {
      setActionLoading(true);
      setActionError('');
      if (selectedMedicine) {
        await api.put(`/medicines/${selectedMedicine.id}`, editForm);
      } else {
        await api.post('/medicines', editForm);
      }
      setShowEditModal(false);
      setSelectedMedicine(null);
      fetchMedicines();
    } catch (error) {
      console.error('Failed to save medicine:', error);
      setActionError('Failed to save medicine');
    } finally {
      setActionLoading(false);
    }
  };

  const addDosageOption = () => {
    setEditForm(prev => ({
      ...prev,
      dosageOptions: [...prev.dosageOptions, { id: String(Date.now()), strength: '', unit: 'mg', price: 0 }],
    }));
  };

  const removeDosageOption = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      dosageOptions: prev.dosageOptions.filter((_, i) => i !== index),
    }));
  };

  const updateDosageOption = (index: number, field: string, value: string | number) => {
    setEditForm(prev => ({
      ...prev,
      dosageOptions: prev.dosageOptions.map((opt, i) => i === index ? { ...opt, [field]: value } : opt),
    }));
  };

  const handleExport = async () => {
    try {
      setActionError('');
      const response = await api.get('/admin/medicines/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `medicines-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
      setActionError('Failed to export medicines');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getPrescriptionBadge = (type: string) => {
    const config = prescriptionTypes.find(p => p.value === type);
    return config || { label: type, color: 'bg-gray-100 text-gray-700' };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Medicines</h1>
          <p className="text-gray-600">{totalMedicines.toLocaleString()} medicines in catalog</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => { setSelectedMedicine(null); setEditForm({ name: '', genericName: '', category: '', type: 'tablet', prescriptionRequirement: 'otc', manufacturer: '', description: '', dosageOptions: [{ id: '1', strength: '', unit: 'mg', price: 0 }], isActive: true }); setShowEditModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            Add Medicine
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or generic name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : medicines.length === 0 ? (
          <div className="text-center py-12">
            <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No medicines found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Medicine</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Price Range</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {medicines.map((medicine) => {
                  const rxBadge = getPrescriptionBadge(medicine.prescriptionRequirement);
                  const prices = medicine.dosageOptions.map(d => d.price);
                  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

                  return (
                    <tr key={medicine.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                            {medicine.images?.[0] ? (
                              <img src={medicine.images[0]} alt={medicine.name} className="w-10 h-10 object-cover rounded" />
                            ) : (
                              <Pill className="w-6 h-6 text-emerald-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900" title={medicine.name}>{medicine.name}</p>
                            <p className="truncate text-sm text-gray-500" title={medicine.genericName}>{medicine.genericName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{medicine.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${rxBadge.color}`}>
                          {rxBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {medicine.isActive ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                            <AlertTriangle className="w-4 h-4" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === medicine.id ? null : medicine.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                          {activeDropdown === medicine.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                              <button
                                onClick={() => { setSelectedMedicine(medicine); setShowViewModal(true); setActiveDropdown(null); }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" /> View Details
                              </button>
                              <button
                                onClick={() => handleEdit(medicine)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" /> Edit
                              </button>
                              <button
                                onClick={() => handleToggleStatus(medicine)}
                                disabled={actionLoading}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                {medicine.isActive ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                {medicine.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => { setSelectedMedicine(medicine); setShowDeleteModal(true); setActiveDropdown(null); }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      {showViewModal && selectedMedicine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Medicine Details</h2>
              <button onClick={() => { setShowViewModal(false); setSelectedMedicine(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Pill className="w-10 h-10 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedMedicine.name}</h3>
                  <p className="text-gray-500">{selectedMedicine.genericName}</p>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPrescriptionBadge(selectedMedicine.prescriptionRequirement).color}`}>
                      {getPrescriptionBadge(selectedMedicine.prescriptionRequirement).label}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${selectedMedicine.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {selectedMedicine.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{selectedMedicine.category}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-medium text-gray-900 capitalize">{selectedMedicine.type}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Manufacturer</p>
                  <p className="font-medium text-gray-900">{selectedMedicine.manufacturer || 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Added</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedMedicine.createdAt)}</p>
                </div>
              </div>

              {selectedMedicine.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Description</p>
                  <p className="text-gray-600">{selectedMedicine.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Dosage Options</p>
                <div className="space-y-2">
                  {selectedMedicine.dosageOptions.map((opt, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{opt.strength} {opt.unit}</span>
                      <span className="text-emerald-600 font-semibold">${opt.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 p-4 bg-blue-50 rounded-lg text-center">
                  <Package className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-blue-700">{selectedMedicine._count?.inventoryItems || 0}</p>
                  <p className="text-xs text-blue-600">In Warehouses</p>
                </div>
                <div className="flex-1 p-4 bg-green-50 rounded-lg text-center">
                  <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-green-700">{selectedMedicine._count?.orderItems || 0}</p>
                  <p className="text-xs text-green-600">Times Ordered</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{selectedMedicine ? 'Edit Medicine' : 'Add New Medicine'}</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedMedicine(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Amoxicillin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name *</label>
                  <input
                    type="text"
                    value={editForm.genericName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, genericName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Amoxicillin Trihydrate"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="tablet">Tablet</option>
                    <option value="capsule">Capsule</option>
                    <option value="syrup">Syrup</option>
                    <option value="injection">Injection</option>
                    <option value="cream">Cream/Ointment</option>
                    <option value="drops">Drops</option>
                    <option value="inhaler">Inhaler</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prescription Type *</label>
                  <select
                    value={editForm.prescriptionRequirement}
                    onChange={(e) => setEditForm(prev => ({ ...prev, prescriptionRequirement: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    {prescriptionTypes.map(pt => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={editForm.manufacturer}
                    onChange={(e) => setEditForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Pfizer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Brief description of the medicine..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Dosage Options *</label>
                  <button type="button" onClick={addDosageOption} className="text-sm text-emerald-600 hover:text-emerald-700">
                    + Add Option
                  </button>
                </div>
                <div className="space-y-2">
                  {editForm.dosageOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="text"
                        value={opt.strength}
                        onChange={(e) => updateDosageOption(i, 'strength', e.target.value)}
                        placeholder="Strength"
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <select
                        value={opt.unit}
                        onChange={(e) => updateDosageOption(i, 'unit', e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="mg">mg</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="mcg">mcg</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          value={opt.price}
                          onChange={(e) => updateDosageOption(i, 'price', parseFloat(e.target.value) || 0)}
                          placeholder="Price"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      {editForm.dosageOptions.length > 1 && (
                        <button type="button" onClick={() => removeDosageOption(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active (visible to customers)</label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => { setShowEditModal(false); setSelectedMedicine(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={actionLoading || !editForm.name || !editForm.genericName || !editForm.category}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {actionLoading ? 'Saving...' : 'Save Medicine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedMedicine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Medicine?</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{selectedMedicine.name}</strong>? This will also remove it from all inventory records.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setSelectedMedicine(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}