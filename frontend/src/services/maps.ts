// ═══════════════════════════════════════════════════════════════════════════════
// JetMed - Google Maps Service (Frontend)
// ═══════════════════════════════════════════════════════════════════════════════

import { Loader } from '@googlemaps/js-api-loader';
import api from './api';

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let mapsLoader: Loader | null = null;
let isLoaded = false;

const getMapsLoader = (): Loader => {
  if (!mapsLoader) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }
    mapsLoader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry', 'marker'],
    });
  }
  return mapsLoader;
};

export const loadGoogleMaps = async (): Promise<typeof google> => {
  if (isLoaded && window.google) {
    return window.google;
  }
  const loader = getMapsLoader();
  await loader.load();
  isLoaded = true;
  return window.google;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADDRESS AUTOCOMPLETE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AddressSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface AddressDetails {
  placeId: string;
  formattedAddress: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lat: number;
  lng: number;
}

let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;
let geocoder: google.maps.Geocoder | null = null;

/**
 * Initialize Places services
 */
const initPlacesServices = async () => {
  const google = await loadGoogleMaps();
  
  if (!autocompleteService) {
    autocompleteService = new google.maps.places.AutocompleteService();
  }
  
  if (!placesService) {
    // PlacesService requires a map or div element
    const dummyDiv = document.createElement('div');
    placesService = new google.maps.places.PlacesService(dummyDiv);
  }
  
  if (!geocoder) {
    geocoder = new google.maps.Geocoder();
  }
};

/**
 * Get address suggestions for autocomplete
 */
export const getAddressSuggestions = async (
  input: string,
  country: string = 'US'
): Promise<AddressSuggestion[]> => {
  if (!input || input.length < 3) return [];
  
  await initPlacesServices();
  
  return new Promise((resolve) => {
    autocompleteService!.getPlacePredictions(
      {
        input,
        componentRestrictions: { country },
        types: ['address'],
      },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          resolve([]);
          return;
        }
        
        resolve(
          predictions.map((p) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting.main_text,
            secondaryText: p.structured_formatting.secondary_text,
          }))
        );
      }
    );
  });
};

/**
 * Get detailed address information from place ID
 */
export const getAddressDetails = async (placeId: string): Promise<AddressDetails | null> => {
  await initPlacesServices();
  
  return new Promise((resolve) => {
    placesService!.getDetails(
      {
        placeId,
        fields: ['address_components', 'formatted_address', 'geometry'],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          resolve(null);
          return;
        }
        
        const components = place.address_components || [];
        const getComponent = (type: string) =>
          components.find((c) => c.types.includes(type))?.long_name;
        
        resolve({
          placeId,
          formattedAddress: place.formatted_address || '',
          streetNumber: getComponent('street_number'),
          street: getComponent('route'),
          city: getComponent('locality') || getComponent('sublocality'),
          state: getComponent('administrative_area_level_1'),
          postalCode: getComponent('postal_code'),
          country: getComponent('country'),
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
        });
      }
    );
  });
};

/**
 * Geocode an address string
 */
export const geocodeAddress = async (
  address: string
): Promise<{ lat: number; lng: number } | null> => {
  await initPlacesServices();
  
  return new Promise((resolve) => {
    geocoder!.geocode({ address }, (results, status) => {
      if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) {
        resolve(null);
        return;
      }
      
      resolve({
        lat: results[0].geometry.location.lat(),
        lng: results[0].geometry.location.lng(),
      });
    });
  });
};

/**
 * Reverse geocode coordinates to address
 */
export const reverseGeocode = async (
  lat: number,
  lng: number
): Promise<string | null> => {
  await initPlacesServices();
  
  return new Promise((resolve) => {
    geocoder!.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) {
        resolve(null);
        return;
      }
      resolve(results[0].formatted_address);
    });
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAP COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MapOptions {
  center: { lat: number; lng: number };
  zoom: number;
  disableDefaultUI?: boolean;
  zoomControl?: boolean;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
}

/**
 * Create a map instance
 */
export const createMap = async (
  container: HTMLElement,
  options: MapOptions
): Promise<google.maps.Map> => {
  const google = await loadGoogleMaps();
  
  return new google.maps.Map(container, {
    center: options.center,
    zoom: options.zoom,
    disableDefaultUI: options.disableDefaultUI ?? true,
    zoomControl: options.zoomControl ?? true,
    mapTypeControl: options.mapTypeControl ?? false,
    streetViewControl: options.streetViewControl ?? false,
    fullscreenControl: options.fullscreenControl ?? true,
    styles: [
      // Subtle custom styling for JetMed branding
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      },
      {
        featureType: 'transit',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      },
    ],
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// MARKERS
// ═══════════════════════════════════════════════════════════════════════════════

export type MarkerType = 'delivery' | 'customer' | 'pharmacy' | 'warehouse';

const markerIcons: Record<MarkerType, string> = {
  delivery: '🛵',
  customer: '📍',
  pharmacy: '💊',
  warehouse: '🏭',
};

/**
 * Create a marker
 */
export const createMarker = async (
  map: google.maps.Map,
  position: { lat: number; lng: number },
  type: MarkerType,
  title?: string
): Promise<google.maps.Marker> => {
  const google = await loadGoogleMaps();
  
  return new google.maps.Marker({
    map,
    position,
    title,
    label: {
      text: markerIcons[type],
      fontSize: '24px',
    },
    animation: google.maps.Animation.DROP,
  });
};

/**
 * Create animated delivery marker
 */
export const createDeliveryMarker = async (
  map: google.maps.Map,
  position: { lat: number; lng: number }
): Promise<google.maps.Marker> => {
  const google = await loadGoogleMaps();
  
  const marker = new google.maps.Marker({
    map,
    position,
    icon: {
      url: '/icons/delivery-bike.png',
      scaledSize: new google.maps.Size(40, 40),
      anchor: new google.maps.Point(20, 20),
    },
    optimized: false, // Required for smooth animations
  });
  
  return marker;
};

/**
 * Animate marker along a path
 */
export const animateMarkerAlongPath = (
  marker: google.maps.Marker,
  path: google.maps.LatLng[],
  duration: number = 10000
): void => {
  const startTime = Date.now();
  const totalPoints = path.length;
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const index = Math.floor(progress * (totalPoints - 1));
    
    if (index < totalPoints - 1) {
      const segmentProgress = (progress * (totalPoints - 1)) - index;
      const start = path[index];
      const end = path[index + 1];
      
      const lat = start.lat() + (end.lat() - start.lat()) * segmentProgress;
      const lng = start.lng() + (end.lng() - start.lng()) * segmentProgress;
      
      marker.setPosition({ lat, lng });
      
      // Calculate bearing for rotation
      const bearing = google.maps.geometry.spherical.computeHeading(start, end);
      const icon = marker.getIcon() as google.maps.Icon;
      if (icon) {
        // Rotate icon based on bearing
        marker.setIcon({
          ...icon,
          rotation: bearing,
        });
      }
      
      requestAnimationFrame(animate);
    }
  };
  
  requestAnimationFrame(animate);
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export interface DeliveryLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

export interface DeliveryTrackingData {
  orderId: string;
  driverLocation: DeliveryLocation;
  customerLocation: { lat: number; lng: number };
  pharmacyLocation: { lat: number; lng: number };
  eta: number; // minutes
  distance: number; // meters
  status: 'picked_up' | 'in_transit' | 'arriving' | 'delivered';
}

/**
 * Get delivery tracking data
 */
export const getDeliveryTracking = async (orderId: string): Promise<DeliveryTrackingData> => {
  const response = await api.get(`/delivery/${orderId}/tracking`);
  return response.data.data;
};

/**
 * Calculate distance between two points
 */
export const calculateDistance = async (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<number> => {
  const google = await loadGoogleMaps();
  
  const from = new google.maps.LatLng(origin.lat, origin.lng);
  const to = new google.maps.LatLng(destination.lat, destination.lng);
  
  return google.maps.geometry.spherical.computeDistanceBetween(from, to);
};

/**
 * Draw route on map
 */
export const drawRoute = async (
  map: google.maps.Map,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints?: { lat: number; lng: number }[]
): Promise<google.maps.DirectionsRenderer> => {
  const google = await loadGoogleMaps();
  
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true, // We'll add custom markers
    polylineOptions: {
      strokeColor: '#2563eb',
      strokeWeight: 4,
      strokeOpacity: 0.8,
    },
  });
  
  const waypointsArray = waypoints?.map((wp) => ({
    location: new google.maps.LatLng(wp.lat, wp.lng),
    stopover: true,
  }));
  
  const request: google.maps.DirectionsRequest = {
    origin: new google.maps.LatLng(origin.lat, origin.lng),
    destination: new google.maps.LatLng(destination.lat, destination.lng),
    waypoints: waypointsArray,
    travelMode: google.maps.TravelMode.DRIVING,
    optimizeWaypoints: true,
  };
  
  const result = await directionsService.route(request);
  directionsRenderer.setDirections(result);
  
  return directionsRenderer;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY ZONE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const DELIVERY_RADIUS_KM = 15;

/**
 * Check if location is within delivery zone
 */
export const isWithinDeliveryZone = async (
  customerLocation: { lat: number; lng: number },
  warehouseLocation: { lat: number; lng: number }
): Promise<boolean> => {
  const distance = await calculateDistance(customerLocation, warehouseLocation);
  return distance <= DELIVERY_RADIUS_KM * 1000;
};

/**
 * Get nearest warehouse for delivery
 */
export const getNearestWarehouse = async (
  lat: number,
  lng: number
): Promise<{ warehouseId: string; distance: number; canDeliver: boolean } | null> => {
  const response = await api.get('/delivery/nearest-warehouse', {
    params: { lat, lng },
  });
  return response.data.data;
};

/**
 * Draw delivery zone circle on map
 */
export const drawDeliveryZone = async (
  map: google.maps.Map,
  center: { lat: number; lng: number },
  radiusKm: number = DELIVERY_RADIUS_KM
): Promise<google.maps.Circle> => {
  const google = await loadGoogleMaps();
  
  return new google.maps.Circle({
    map,
    center,
    radius: radiusKm * 1000,
    strokeColor: '#2563eb',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#2563eb',
    fillOpacity: 0.1,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATIC MAP URLs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate static map URL for order confirmation
 */
export const getStaticMapUrl = (
  center: { lat: number; lng: number },
  markers?: { lat: number; lng: number; label: string }[],
  size: string = '400x300',
  zoom: number = 15
): string => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return '';
  
  let url = `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat},${center.lng}&zoom=${zoom}&size=${size}&key=${apiKey}`;
  
  markers?.forEach((marker) => {
    url += `&markers=label:${marker.label}|${marker.lat},${marker.lng}`;
  });
  
  return url;
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER LOCATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get user's current location
 */
export const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
};

/**
 * Watch user's location for live tracking
 */
export const watchLocation = (
  onUpdate: (location: { lat: number; lng: number }) => void,
  onError?: (error: GeolocationPositionError) => void
): number => {
  return navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    onError,
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    }
  );
};

/**
 * Stop watching location
 */
export const clearLocationWatch = (watchId: number): void => {
  navigator.geolocation.clearWatch(watchId);
};

export default {
  loadGoogleMaps,
  getAddressSuggestions,
  getAddressDetails,
  geocodeAddress,
  reverseGeocode,
  createMap,
  createMarker,
  createDeliveryMarker,
  animateMarkerAlongPath,
  getDeliveryTracking,
  calculateDistance,
  drawRoute,
  isWithinDeliveryZone,
  getNearestWarehouse,
  drawDeliveryZone,
  getStaticMapUrl,
  getCurrentLocation,
  watchLocation,
  clearLocationWatch,
};
