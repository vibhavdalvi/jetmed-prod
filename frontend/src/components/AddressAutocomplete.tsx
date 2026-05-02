import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPinIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

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

interface AddressAutocompleteProps {
  onAddressSelect: (address: AddressData) => void;
  initialAddress?: Partial<AddressData>;
  placeholder?: string;
  showMap?: boolean;
  apiKey: string;
}

// Check if Google Maps is loaded
const isGoogleMapsLoaded = (): boolean => {
  return !!(window.google && window.google.maps && window.google.maps.places);
};

// Load Google Maps script
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isGoogleMapsLoaded()) {
      resolve();
      return;
    }

    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
};

export default function AddressAutocomplete({
  onAddressSelect,
  initialAddress,
  placeholder = 'Search for your address...',
  showMap = true,
  apiKey,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(initialAddress?.formattedAddress || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressData | null>(null);
  const [apartment, setApartment] = useState(initialAddress?.apartment || '');
  const [error, setError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  // Using 'any' to avoid Google Maps type issues - types are loaded dynamically
  const autocompleteRef = useRef<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Load Google Maps
  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key is required');
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => setIsLoaded(true))
      .catch((err) => setError(err.message));
  }, [apiKey]);

  // Initialize Autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current || !window.google) return;

    const google = window.google;
    
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'geometry', 'formatted_address'],
    });

    autocompleteRef.current.addListener('place_changed', handlePlaceSelect);

    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded]);

  // Initialize Map
  useEffect(() => {
    if (!isLoaded || !showMap || !mapRef.current || !window.google) return;

    const google = window.google;
    const defaultCenter = { lat: 40.7128, lng: -74.006 }; // NYC default

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: selectedAddress
        ? { lat: selectedAddress.latitude, lng: selectedAddress.longitude }
        : defaultCenter,
      zoom: selectedAddress ? 16 : 12,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    if (selectedAddress) {
      markerRef.current = new google.maps.Marker({
        position: { lat: selectedAddress.latitude, lng: selectedAddress.longitude },
        map: mapInstanceRef.current,
        animation: google.maps.Animation.DROP,
      });
    }
  }, [isLoaded, showMap]);

  // Update map when address changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedAddress || !window.google) return;

    const google = window.google;
    const position = { lat: selectedAddress.latitude, lng: selectedAddress.longitude };
    mapInstanceRef.current.setCenter(position);
    mapInstanceRef.current.setZoom(16);

    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        animation: google.maps.Animation.DROP,
      });
    }
  }, [selectedAddress]);

  const handlePlaceSelect = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();

    if (!place?.geometry?.location || !place.address_components) {
      setError('Please select a valid address from the suggestions');
      return;
    }

    const addressComponents = place.address_components;
    let streetNumber = '';
    let route = '';
    let city = '';
    let state = '';
    let zipCode = '';
    let country = '';

    addressComponents.forEach((component: any) => {
      const types = component.types;

      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (types.includes('route')) {
        route = component.long_name;
      } else if (types.includes('locality') || types.includes('sublocality')) {
        city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        state = component.short_name;
      } else if (types.includes('postal_code')) {
        zipCode = component.long_name;
      } else if (types.includes('country')) {
        country = component.long_name;
      }
    });

    const addressData: AddressData = {
      streetAddress: `${streetNumber} ${route}`.trim(),
      city,
      state,
      zipCode,
      country,
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
      formattedAddress: place.formatted_address || '',
    };

    setSelectedAddress(addressData);
    setInputValue(place.formatted_address || '');
    setError('');
  }, []);

  const handleConfirm = () => {
    if (!selectedAddress) {
      setError('Please select an address');
      return;
    }

    onAddressSelect({
      ...selectedAddress,
      apartment,
    });
  };

  const handleClear = () => {
    setInputValue('');
    setSelectedAddress(null);
    setApartment('');
    setError('');
    inputRef.current?.focus();
  };

  if (error && !isLoaded) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={!isLoaded}
        />
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      {!isLoaded && !error && (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent"></div>
          Loading maps...
        </div>
      )}

      {error && isLoaded && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Selected Address Details */}
      {selectedAddress && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-4">
          <div className="flex items-start gap-3">
            <MapPinIcon className="w-5 h-5 text-primary-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {selectedAddress.streetAddress}
              </p>
              <p className="text-sm text-gray-500">
                {selectedAddress.city}, {selectedAddress.state} {selectedAddress.zipCode}
              </p>
            </div>
          </div>

          {/* Apartment/Unit Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Apartment, suite, unit, etc. (optional)
            </label>
            <input
              type="text"
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              placeholder="Apt 4B, Suite 100, etc."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Map Preview */}
          {showMap && (
            <div
              ref={mapRef}
              className="w-full h-48 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
            />
          )}

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            className="w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-medium"
          >
            Confirm Address
          </button>
        </div>
      )}
    </div>
  );
}