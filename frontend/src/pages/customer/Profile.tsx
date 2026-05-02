import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CreditCardIcon,
  BellIcon,
  ShieldCheckIcon,
  CameraIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  ExclamationTriangleIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import { useAppSelector, useAppDispatch } from '../../features/hooks';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';

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

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface NotificationSettings {
  inApp: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  pharmacistMessages: boolean;
}

const tabs = [
  { id: 'personal', label: 'Personal Info', icon: UserIcon },
  { id: 'medical', label: 'Medical Info', icon: HeartIcon },
  { id: 'addresses', label: 'Addresses', icon: MapPinIcon },
  { id: 'payments', label: 'Payment Methods', icon: CreditCardIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'security', label: 'Security', icon: ShieldCheckIcon },
];

export default function Profile() {
  const { user } = useAppSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true' ||
      (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Personal Info State
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'prefer_not_to_say',
    avatar: '',
  });

  // Medical Info State
  const [medicalInfo, setMedicalInfo] = useState({
    allergies: [] as string[],
    chronicConditions: [] as string[],
    currentMedications: [] as string[],
    bloodType: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [newAllergy, setNewAllergy] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [newMedication, setNewMedication] = useState('');

  // Addresses State
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);

  // Payment Methods State
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Notification Settings State
  const [notifications, setNotifications] = useState<NotificationSettings>({
    inApp: true,
    push: true,
    email: true,
    sms: false,
    whatsapp: false,
    orderUpdates: true,
    promotions: false,
    pharmacistMessages: true,
  });

  // Security State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Load user data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [userResponse, addressResponse, medicalResponse, notificationResponse] = await Promise.all([
          api.get('/users/me'),
          api.get('/users/me/addresses'),
          api.get('/users/me/medical-info'),
          api.get('/users/me/notifications'),
        ]);
        const data = userResponse.data.data?.user;
        const profile = data?.profile || {};
        const medical = medicalResponse.data?.data?.medicalInfo || data?.medicalInfo || {};
        const notificationPrefs = notificationResponse.data?.data?.notifications || {};
        
        setPersonalInfo({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: data?.email || '',
          phone: data?.phone || '',
          dateOfBirth: profile.dateOfBirth || '',
          gender: profile.gender || 'prefer_not_to_say',
          avatar: profile.avatar || '',
        });
        setAddresses((addressResponse.data.data?.addresses || []).map((addr: any) => ({
          id: addr.id,
          label: addr.label,
          street: addr.streetAddress,
          apartment: addr.apartment,
          city: addr.city,
          state: addr.state,
          zipCode: addr.zipCode,
          isDefault: addr.isDefault,
        })));
        setMedicalInfo({
          allergies: medical?.allergies || [],
          chronicConditions: medical?.chronicConditions || [],
          currentMedications: medical?.currentMedications || [],
          bloodType: medical?.bloodType || '',
          emergencyContactName: medical?.emergencyContactName || '',
          emergencyContactPhone: medical?.emergencyContactPhone || '',
        });
        setNotifications((prev) => ({
          ...prev,
          ...notificationPrefs,
        }));
        setPaymentMethods([]);
        setTwoFactorEnabled(data?.twoFactorEnabled || false);
      } catch (error) {
        console.error('Failed to load profile:', error);
        setSaveError('Unable to load profile data right now.');
      }
    };

    loadProfile();
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('darkMode', String(newValue));
    if (newValue) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Save handlers
  const savePersonalInfo = async () => {
    setIsLoading(true);
    try {
      setSaveError('');
      await api.put('/users/me', {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        dateOfBirth: personalInfo.dateOfBirth || undefined,
        gender: personalInfo.gender,
      });
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to save:', error);
      setSaveError('Failed to save personal information.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveMedicalInfo = async () => {
    setIsLoading(true);
    try {
      setSaveError('');
      await api.put('/users/me/medical-info', {
        allergies: medicalInfo.allergies,
        chronicConditions: medicalInfo.chronicConditions,
        currentMedications: medicalInfo.currentMedications,
        bloodType: medicalInfo.bloodType || null,
        emergencyContactName: medicalInfo.emergencyContactName || null,
        emergencyContactPhone: medicalInfo.emergencyContactPhone || null,
      });
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to save medical info:', error);
      setSaveError('Failed to save medical information.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotifications = async () => {
    setIsLoading(true);
    try {
      setSaveError('');
      await api.put('/users/me/notifications', notifications);
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to save notifications:', error);
      setSaveError('Failed to save notification preferences.');
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setSaveError("Passwords don't match.");
      return;
    }
    setIsLoading(true);
    try {
      setSaveError('');
      await api.put('/users/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to change password:', error);
      setSaveError('Failed to change password.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggle2FA = async () => {
    setSaveError('2FA toggle requires the auth verification flow and is not enabled from profile yet.');
  };

  const showSaveSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Address handlers
  const saveAddress = async (address: Address) => {
    setIsLoading(true);
    try {
      setSaveError('');
      if (address.id) {
        await api.put(`/users/me/addresses/${address.id}`, {
          label: address.label,
          streetAddress: address.street,
          apartment: address.apartment,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          isDefault: address.isDefault,
        });
        setAddresses(addresses.map(a => a.id === address.id ? address : a));
      } else {
        const response = await api.post('/users/me/addresses', {
          label: address.label,
          streetAddress: address.street,
          apartment: address.apartment,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          isDefault: address.isDefault,
        });
        setAddresses([...addresses, { ...address, id: response.data.data?.address?.id || '' }]);
      }
      setShowAddressModal(false);
      setEditingAddress(null);
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to save address:', error);
      setSaveError('Failed to save address.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      setSaveError('');
      await api.delete(`/users/me/addresses/${id}`);
      setAddresses(addresses.filter(a => a.id !== id));
    } catch (error) {
      console.error('Failed to delete address:', error);
      setSaveError('Failed to delete address.');
    }
  };

  const setDefaultAddress = async (id: string) => {
    try {
      setSaveError('');
      await api.put(`/users/me/addresses/${id}`, { isDefault: true });
      setAddresses(addresses.map(a => ({ ...a, isDefault: a.id === id })));
    } catch (error) {
      console.error('Failed to set default:', error);
      setSaveError('Failed to set default address.');
    }
  };

  // Medical info helpers
  const addAllergy = () => {
    if (newAllergy.trim() && !medicalInfo.allergies.includes(newAllergy.trim())) {
      setMedicalInfo({ ...medicalInfo, allergies: [...medicalInfo.allergies, newAllergy.trim()] });
      setNewAllergy('');
    }
  };

  const removeAllergy = (allergy: string) => {
    setMedicalInfo({ ...medicalInfo, allergies: medicalInfo.allergies.filter(a => a !== allergy) });
  };

  const addCondition = () => {
    if (newCondition.trim() && !medicalInfo.chronicConditions.includes(newCondition.trim())) {
      setMedicalInfo({ ...medicalInfo, chronicConditions: [...medicalInfo.chronicConditions, newCondition.trim()] });
      setNewCondition('');
    }
  };

  const removeCondition = (condition: string) => {
    setMedicalInfo({ ...medicalInfo, chronicConditions: medicalInfo.chronicConditions.filter(c => c !== condition) });
  };

  const addMedication = () => {
    if (newMedication.trim() && !medicalInfo.currentMedications.includes(newMedication.trim())) {
      setMedicalInfo({ ...medicalInfo, currentMedications: [...medicalInfo.currentMedications, newMedication.trim()] });
      setNewMedication('');
    }
  };

  const removeMedication = (medication: string) => {
    setMedicalInfo({ ...medicalInfo, currentMedications: medicalInfo.currentMedications.filter(m => m !== medication) });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Success Toast */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <CheckIcon className="w-5 h-5" />
            Changes saved successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account settings and preferences</p>
        </div>
        
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {darkMode ? (
            <>
              <SunIcon className="w-5 h-5 text-yellow-500" />
              <span className="text-sm">Light Mode</span>
            </>
          ) : (
            <>
              <MoonIcon className="w-5 h-5 text-gray-600" />
              <span className="text-sm">Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {saveError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <nav className="card p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {/* Personal Info Tab */}
            {activeTab === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="card p-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Personal Information</h2>

                {/* Avatar */}
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-3xl font-bold text-primary-600">
                      {personalInfo.firstName?.[0]}{personalInfo.lastName?.[0]}
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-primary-700">
                      <CameraIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                      {personalInfo.firstName} {personalInfo.lastName}
                    </h3>
                    <p className="break-all text-gray-500" title={personalInfo.email}>
                      {personalInfo.email}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={personalInfo.firstName}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, firstName: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={personalInfo.lastName}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, lastName: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={personalInfo.email}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={personalInfo.phone}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={personalInfo.dateOfBirth}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, dateOfBirth: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Gender
                    </label>
                    <select
                      value={personalInfo.gender}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, gender: e.target.value })}
                      className="input"
                    >
                      <option value="prefer_not_to_say">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button onClick={savePersonalInfo} disabled={isLoading} className="btn-primary">
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Medical Info Tab */}
            {activeTab === 'medical' && (
              <motion.div
                key="medical"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="card p-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Medical Information</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  This information helps pharmacists verify prescriptions safely. It remains anonymous during review.
                </p>

                {/* Allergies */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Known Allergies
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {medicalInfo.allergies.map((allergy) => (
                      <span
                        key={allergy}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm"
                      >
                        {allergy}
                        <button onClick={() => removeAllergy(allergy)} className="hover:text-red-900">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAllergy}
                      onChange={(e) => setNewAllergy(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                      placeholder="Add allergy (e.g., Penicillin)"
                      className="input flex-1"
                    />
                    <button onClick={addAllergy} className="btn-outline">
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Chronic Conditions */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Chronic Conditions
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {medicalInfo.chronicConditions.map((condition) => (
                      <span
                        key={condition}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm"
                      >
                        {condition}
                        <button onClick={() => removeCondition(condition)} className="hover:text-orange-900">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCondition()}
                      placeholder="Add condition (e.g., Diabetes)"
                      className="input flex-1"
                    />
                    <button onClick={addCondition} className="btn-outline">
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Current Medications */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Medications
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {medicalInfo.currentMedications.map((medication) => (
                      <span
                        key={medication}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                      >
                        {medication}
                        <button onClick={() => removeMedication(medication)} className="hover:text-blue-900">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMedication}
                      onChange={(e) => setNewMedication(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addMedication()}
                      placeholder="Add medication (e.g., Metformin 500mg)"
                      className="input flex-1"
                    />
                    <button onClick={addMedication} className="btn-outline">
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Blood Type & Emergency Contact */}
                <div className="grid md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Blood Type
                    </label>
                    <select
                      value={medicalInfo.bloodType}
                      onChange={(e) => setMedicalInfo({ ...medicalInfo, bloodType: e.target.value })}
                      className="input"
                    >
                      <option value="">Select</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={medicalInfo.emergencyContactName}
                      onChange={(e) => setMedicalInfo({ ...medicalInfo, emergencyContactName: e.target.value })}
                      className="input"
                      placeholder="Contact name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={medicalInfo.emergencyContactPhone}
                      onChange={(e) => setMedicalInfo({ ...medicalInfo, emergencyContactPhone: e.target.value })}
                      className="input"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={saveMedicalInfo} disabled={isLoading} className="btn-primary">
                    {isLoading ? 'Saving...' : 'Save Medical Info'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Addresses Tab */}
            {activeTab === 'addresses' && (
              <motion.div
                key="addresses"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="card p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Saved Addresses</h2>
                  <button
                    onClick={() => {
                      setEditingAddress({ id: '', label: '', street: '', apartment: '', city: '', state: '', zipCode: '', isDefault: false });
                      setShowAddressModal(true);
                    }}
                    className="btn-primary"
                  >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Add Address
                  </button>
                </div>

                <div className="space-y-4">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`p-4 rounded-xl border-2 transition-colors ${
                        address.isDefault
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white">{address.label}</span>
                            {address.isDefault && (
                              <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs rounded-full">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 dark:text-gray-400">
                            {address.street}
                            {address.apartment && `, ${address.apartment}`}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400">
                            {address.city}, {address.state} {address.zipCode}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!address.isDefault && (
                            <button
                              onClick={() => setDefaultAddress(address.id)}
                              className="text-sm text-primary-600 hover:text-primary-700"
                            >
                              Set as default
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingAddress(address);
                              setShowAddressModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setAddressToDelete(address.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {addresses.length === 0 && (
                    <div className="text-center py-12">
                      <MapPinIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                      <p className="text-gray-500">No addresses saved yet</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Payment Methods Tab */}
            {activeTab === 'payments' && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="card p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Payment Methods</h2>
                  <button className="btn-primary">
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Add Card
                  </button>
                </div>

                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`p-4 rounded-xl border-2 transition-colors ${
                        method.isDefault
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs font-bold">
                            {method.brand}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              •••• •••• •••• {method.last4}
                            </p>
                            <p className="text-sm text-gray-500">
                              Expires {method.expiryMonth}/{method.expiryYear}
                            </p>
                          </div>
                          {method.isDefault && (
                            <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <button className="p-2 text-gray-400 hover:text-red-600">
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {paymentMethods.length === 0 && (
                    <div className="text-center py-12">
                      <CreditCardIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                      <p className="text-gray-500">No payment methods saved yet</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="card p-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Notification Preferences</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4">Notification Channels</h3>
                    <div className="space-y-3">
                      {[
                        { key: 'inApp', label: 'In-App Notifications', desc: 'Notifications within the JetMed app' },
                        { key: 'push', label: 'Push Notifications', desc: 'Mobile push notifications' },
                        { key: 'email', label: 'Email Notifications', desc: 'Updates sent to your email' },
                        { key: 'sms', label: 'SMS Notifications', desc: 'Text messages to your phone' },
                        { key: 'whatsapp', label: 'WhatsApp Notifications', desc: 'Messages via WhatsApp' },
                      ].map((item) => (
                        <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.label}</p>
                            <p className="text-sm text-gray-500">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={notifications[item.key as keyof NotificationSettings] as boolean}
                            onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                            className="w-5 h-5 rounded text-primary-600"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4">Notification Types</h3>
                    <div className="space-y-3">
                      {[
                        { key: 'orderUpdates', label: 'Order Updates', desc: 'Status changes, delivery updates' },
                        { key: 'pharmacistMessages', label: 'Pharmacist Messages', desc: 'Communication from pharmacists' },
                        { key: 'promotions', label: 'Promotions & Offers', desc: 'Deals and discount notifications' },
                      ].map((item) => (
                        <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.label}</p>
                            <p className="text-sm text-gray-500">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={notifications[item.key as keyof NotificationSettings] as boolean}
                            onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                            className="w-5 h-5 rounded text-primary-600"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button onClick={saveNotifications} disabled={isLoading} className="btn-primary">
                    {isLoading ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Change Password */}
                <div className="card p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Change Password</h2>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="input"
                      />
                    </div>
                    <button onClick={changePassword} disabled={isLoading} className="btn-primary">
                      {isLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </div>

                {/* Two-Factor Authentication */}
                <div className="card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Two-Factor Authentication</h2>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <button
                      onClick={toggle2FA}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                        twoFactorEnabled
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="card p-6 border-2 border-red-200 dark:border-red-900">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-red-600">Danger Zone</h2>
                      <p className="text-gray-500 dark:text-gray-400 mt-1 mb-4">
                        Once you delete your account, there is no going back. Please be certain.
                      </p>
                      <button className="btn bg-red-600 text-white hover:bg-red-700">
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Address Modal */}
      <AnimatePresence>
        {showAddressModal && editingAddress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowAddressModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {editingAddress.id ? 'Edit Address' : 'Add New Address'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Label</label>
                  <input
                    type="text"
                    value={editingAddress.label}
                    onChange={(e) => setEditingAddress({ ...editingAddress, label: e.target.value })}
                    placeholder="Home, Office, etc."
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Street Address</label>
                  <input
                    type="text"
                    value={editingAddress.street}
                    onChange={(e) => setEditingAddress({ ...editingAddress, street: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Apartment/Suite (Optional)</label>
                  <input
                    type="text"
                    value={editingAddress.apartment || ''}
                    onChange={(e) => setEditingAddress({ ...editingAddress, apartment: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <input
                      type="text"
                      value={editingAddress.city}
                      onChange={(e) => setEditingAddress({ ...editingAddress, city: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">State</label>
                    <input
                      type="text"
                      value={editingAddress.state}
                      onChange={(e) => setEditingAddress({ ...editingAddress, state: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">ZIP</label>
                    <input
                      type="text"
                      value={editingAddress.zipCode}
                      onChange={(e) => setEditingAddress({ ...editingAddress, zipCode: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAddressModal(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button onClick={() => saveAddress(editingAddress)} disabled={isLoading} className="btn-primary flex-1">
                  {isLoading ? 'Saving...' : 'Save Address'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!addressToDelete}
        title="Delete address?"
        message="This address will be removed from your profile."
        confirmLabel="Delete"
        isDestructive
        onCancel={() => setAddressToDelete(null)}
        onConfirm={async () => {
          if (!addressToDelete) return;
          await deleteAddress(addressToDelete);
          setAddressToDelete(null);
        }}
      />
    </div>
  );
}
