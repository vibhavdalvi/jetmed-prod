import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, HomeIcon, BuildingOfficeIcon, MapPinIcon } from '@heroicons/react/24/outline';
import AddressAutocomplete from './AddressAutocomplete';

interface AddressData {
  streetAddress: string;
  apartment?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

interface AddAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: AddressData & { label: string; isDefault: boolean }) => void;
}

export default function AddAddressModal({ isOpen, onClose, onSave }: AddAddressModalProps) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const handleAddressSelect = (address: AddressData) => {
    // For this example, we'll save with default label
    onSave({
      ...address,
      label: 'Home',
      isDefault: false,
    });
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                    Add New Address
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Address Type Selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address Type
                  </label>
                  <div className="flex gap-3">
                    {[
                      { icon: HomeIcon, label: 'Home' },
                      { icon: BuildingOfficeIcon, label: 'Work' },
                      { icon: MapPinIcon, label: 'Other' },
                    ].map(({ icon: Icon, label }) => (
                      <button
                        key={label}
                        className="flex-1 flex flex-col items-center gap-2 p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition"
                      >
                        <Icon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Address Autocomplete */}
                {googleMapsApiKey ? (
                  <AddressAutocomplete
                    apiKey={googleMapsApiKey}
                    onAddressSelect={handleAddressSelect}
                    showMap={true}
                    placeholder="Search for your address..."
                  />
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      <strong>Note:</strong> Google Maps API key not configured. 
                      Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your .env file.
                    </p>
                    {/* Fallback manual form would go here */}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
