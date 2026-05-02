// @ts-nocheck
/**
 * ============================================
 * GOOGLE MAPS SERVICE
 * ============================================
 * Complete Google Maps integration for:
 * - Address autocomplete (Places API)
 * - Geocoding (convert address to coordinates)
 * - Reverse geocoding (coordinates to address)
 * - Distance/duration calculation
 * - Delivery route optimization
 * - Real-time delivery tracking
 * 
 * Based on 38 Questions: Q6 - Delivery System
 * - Real-time GPS tracking when out for delivery
 * - Address validation
 * - Delivery instructions
 */

import { Client, PlaceAutocompleteType, TravelMode } from '@googlemaps/google-maps-services-js';

// Initialize Google Maps client
const mapsClient = new Client({});
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// ============================================
// TYPES
// ============================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AddressComponent {
  longName: string;
  shortName: string;
  types: string[];
}

export interface FormattedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  fullAddress: string;
  coordinates: Coordinates;
  placeId?: string;
}

export interface AutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface DistanceResult {
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
}

export interface RouteResult {
  distance: DistanceResult;
  polyline: string;
  steps: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  startLocation: Coordinates;
  endLocation: Coordinates;
}

export interface DeliveryETA {
  estimatedArrival: Date;
  durationText: string;
  distanceText: string;
  trafficCondition: 'light' | 'moderate' | 'heavy';
}

// ============================================
// ADDRESS AUTOCOMPLETE
// ============================================

/**
 * Get address suggestions as user types
 * Used in checkout address form
 */
export const getAddressSuggestions = async (
  input: string,
  sessionToken?: string,
  countryRestriction: string[] = ['us', 'in'] // US and India
): Promise<AutocompleteResult[]> => {
  try {
    const response = await mapsClient.placeAutocomplete({
      params: {
        input,
        key: API_KEY,
        types: PlaceAutocompleteType.address,
        components: countryRestriction.map(c => `country:${c}`),
        sessiontoken: sessionToken,
      },
    });

    return response.data.predictions.map(prediction => ({
      placeId: prediction.place_id,
      description: prediction.description,
      mainText: prediction.structured_formatting.main_text,
      secondaryText: prediction.structured_formatting.secondary_text || '',
    }));
  } catch (error) {
    console.error('Address autocomplete error:', error);
    throw new Error('Failed to fetch address suggestions');
  }
};

/**
 * Get place details from place ID
 * Called when user selects an address from suggestions
 */
export const getPlaceDetails = async (
  placeId: string,
  sessionToken?: string
): Promise<FormattedAddress> => {
  try {
    const response = await mapsClient.placeDetails({
      params: {
        place_id: placeId,
        key: API_KEY,
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
        sessiontoken: sessionToken,
      },
    });

    const result = response.data.result;
    const components = result.address_components || [];

    // Extract address components
    const getComponent = (type: string): string => {
      const component = components.find(c => c.types.includes(type));
      return component?.long_name || '';
    };

    const getComponentShort = (type: string): string => {
      const component = components.find(c => c.types.includes(type));
      return component?.short_name || '';
    };

    return {
      street: `${getComponent('street_number')} ${getComponent('route')}`.trim(),
      city: getComponent('locality') || getComponent('sublocality_level_1'),
      state: getComponentShort('administrative_area_level_1'),
      postalCode: getComponent('postal_code'),
      country: getComponentShort('country'),
      fullAddress: result.formatted_address || '',
      coordinates: {
        lat: result.geometry?.location.lat || 0,
        lng: result.geometry?.location.lng || 0,
      },
      placeId: result.place_id,
    };
  } catch (error) {
    console.error('Place details error:', error);
    throw new Error('Failed to fetch place details');
  }
};

// ============================================
// GEOCODING
// ============================================

/**
 * Convert address string to coordinates
 */
export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  try {
    const response = await mapsClient.geocode({
      params: {
        address,
        key: API_KEY,
      },
    });

    if (response.data.results.length === 0) {
      return null;
    }

    const location = response.data.results[0].geometry.location;
    return {
      lat: location.lat,
      lng: location.lng,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Failed to geocode address');
  }
};

/**
 * Convert coordinates to address (reverse geocoding)
 * Used for delivery partner location tracking
 */
export const reverseGeocode = async (
  coordinates: Coordinates
): Promise<FormattedAddress | null> => {
  try {
    const response = await mapsClient.reverseGeocode({
      params: {
        latlng: coordinates,
        key: API_KEY,
      },
    });

    if (response.data.results.length === 0) {
      return null;
    }

    const result = response.data.results[0];
    const components = result.address_components;

    const getComponent = (type: string): string => {
      const component = components.find(c => c.types.includes(type));
      return component?.long_name || '';
    };

    const getComponentShort = (type: string): string => {
      const component = components.find(c => c.types.includes(type));
      return component?.short_name || '';
    };

    return {
      street: `${getComponent('street_number')} ${getComponent('route')}`.trim(),
      city: getComponent('locality') || getComponent('sublocality_level_1'),
      state: getComponentShort('administrative_area_level_1'),
      postalCode: getComponent('postal_code'),
      country: getComponentShort('country'),
      fullAddress: result.formatted_address,
      coordinates,
      placeId: result.place_id,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw new Error('Failed to reverse geocode');
  }
};

// ============================================
// DISTANCE & DURATION
// ============================================

/**
 * Calculate distance and duration between two points
 * Used for delivery fee calculation and ETA
 */
export const calculateDistance = async (
  origin: Coordinates | string,
  destination: Coordinates | string,
  mode: TravelMode = TravelMode.driving
): Promise<DistanceResult> => {
  try {
    const response = await mapsClient.distancematrix({
      params: {
        origins: [typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`],
        destinations: [typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`],
        mode,
        key: API_KEY,
        departure_time: 'now', // For traffic-aware estimates
      },
    });

    const element = response.data.rows[0]?.elements[0];

    if (!element || element.status !== 'OK') {
      throw new Error('Unable to calculate distance');
    }

    return {
      distanceMeters: element.distance.value,
      distanceText: element.distance.text,
      durationSeconds: element.duration.value,
      durationText: element.duration.text,
    };
  } catch (error) {
    console.error('Distance calculation error:', error);
    throw new Error('Failed to calculate distance');
  }
};

/**
 * Calculate distance between multiple points (for route optimization)
 */
export const calculateDistanceMatrix = async (
  origins: (Coordinates | string)[],
  destinations: (Coordinates | string)[]
): Promise<DistanceResult[][]> => {
  try {
    const formatLocation = (loc: Coordinates | string): string =>
      typeof loc === 'string' ? loc : `${loc.lat},${loc.lng}`;

    const response = await mapsClient.distancematrix({
      params: {
        origins: origins.map(formatLocation),
        destinations: destinations.map(formatLocation),
        mode: TravelMode.driving,
        key: API_KEY,
        departure_time: 'now',
      },
    });

    return response.data.rows.map(row =>
      row.elements.map(element => ({
        distanceMeters: element.distance?.value || 0,
        distanceText: element.distance?.text || 'N/A',
        durationSeconds: element.duration?.value || 0,
        durationText: element.duration?.text || 'N/A',
      }))
    );
  } catch (error) {
    console.error('Distance matrix error:', error);
    throw new Error('Failed to calculate distance matrix');
  }
};

// ============================================
// DELIVERY ROUTING
// ============================================

/**
 * Get optimal route for delivery
 * Per Q6: Real-time tracking with GPS
 */
export const getDeliveryRoute = async (
  origin: Coordinates,
  destination: Coordinates,
  waypoints?: Coordinates[]
): Promise<RouteResult> => {
  try {
    const waypointParams = waypoints?.map(wp => `${wp.lat},${wp.lng}`).join('|');

    const response = await mapsClient.directions({
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        waypoints: waypointParams ? `optimize:true|${waypointParams}` : undefined,
        mode: TravelMode.driving,
        departure_time: 'now',
        key: API_KEY,
      },
    });

    if (response.data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];

    return {
      distance: {
        distanceMeters: leg.distance?.value || 0,
        distanceText: leg.distance?.text || '',
        durationSeconds: leg.duration?.value || 0,
        durationText: leg.duration?.text || '',
      },
      polyline: route.overview_polyline?.points || '',
      steps: leg.steps?.map(step => ({
        instruction: step.html_instructions || '',
        distance: step.distance?.text || '',
        duration: step.duration?.text || '',
        startLocation: {
          lat: step.start_location?.lat || 0,
          lng: step.start_location?.lng || 0,
        },
        endLocation: {
          lat: step.end_location?.lat || 0,
          lng: step.end_location?.lng || 0,
        },
      })) || [],
    };
  } catch (error) {
    console.error('Route calculation error:', error);
    throw new Error('Failed to calculate route');
  }
};

/**
 * Calculate delivery ETA from current location
 * Per Q6: Stage-based + live GPS when out for delivery
 */
export const calculateDeliveryETA = async (
  driverLocation: Coordinates,
  destinationLocation: Coordinates
): Promise<DeliveryETA> => {
  const distance = await calculateDistance(driverLocation, destinationLocation);

  const estimatedArrival = new Date(Date.now() + distance.durationSeconds * 1000);

  // Determine traffic condition based on ratio of duration to distance
  const avgSpeedKmh = (distance.distanceMeters / 1000) / (distance.durationSeconds / 3600);
  let trafficCondition: 'light' | 'moderate' | 'heavy' = 'moderate';

  if (avgSpeedKmh > 40) {
    trafficCondition = 'light';
  } else if (avgSpeedKmh < 20) {
    trafficCondition = 'heavy';
  }

  return {
    estimatedArrival,
    durationText: distance.durationText,
    distanceText: distance.distanceText,
    trafficCondition,
  };
};

// ============================================
// DELIVERY ZONE VALIDATION
// ============================================

/**
 * Check if address is within delivery zone
 * Per Q6: Delivery based on radius/zone
 */
export const isInDeliveryZone = async (
  customerLocation: Coordinates,
  warehouseLocation: Coordinates,
  maxDistanceKm: number = 15
): Promise<{ inZone: boolean; distance: number; distanceText: string }> => {
  const distance = await calculateDistance(warehouseLocation, customerLocation);
  const distanceKm = distance.distanceMeters / 1000;

  return {
    inZone: distanceKm <= maxDistanceKm,
    distance: distanceKm,
    distanceText: distance.distanceText,
  };
};

/**
 * Find nearest warehouse to customer
 */
export const findNearestWarehouse = async (
  customerLocation: Coordinates,
  warehouses: Array<{ id: string; location: Coordinates; name: string }>
): Promise<{ warehouse: typeof warehouses[0]; distance: number } | null> => {
  if (warehouses.length === 0) return null;

  const warehouseLocations = warehouses.map(w => w.location);
  const distances = await calculateDistanceMatrix([customerLocation], warehouseLocations);

  let nearestIndex = 0;
  let minDistance = Infinity;

  distances[0].forEach((d, index) => {
    if (d.distanceMeters < minDistance) {
      minDistance = d.distanceMeters;
      nearestIndex = index;
    }
  });

  return {
    warehouse: warehouses[nearestIndex],
    distance: minDistance / 1000, // Convert to km
  };
};

// ============================================
// ADDRESS VALIDATION
// ============================================

/**
 * Validate if address is deliverable
 */
export const validateDeliveryAddress = async (
  address: string | Coordinates
): Promise<{
  valid: boolean;
  formattedAddress?: FormattedAddress;
  error?: string;
}> => {
  try {
    let coordinates: Coordinates;
    let formattedAddress: FormattedAddress | null;

    if (typeof address === 'string') {
      const geocoded = await geocodeAddress(address);
      if (!geocoded) {
        return { valid: false, error: 'Address not found' };
      }
      coordinates = geocoded;
      formattedAddress = await reverseGeocode(coordinates);
    } else {
      coordinates = address;
      formattedAddress = await reverseGeocode(coordinates);
    }

    if (!formattedAddress) {
      return { valid: false, error: 'Unable to validate address' };
    }

    // Basic validation checks
    if (!formattedAddress.street || !formattedAddress.city || !formattedAddress.postalCode) {
      return { valid: false, error: 'Incomplete address' };
    }

    return { valid: true, formattedAddress };
  } catch (error) {
    return { valid: false, error: 'Address validation failed' };
  }
};

// ============================================
// STATIC MAP GENERATION
// ============================================

/**
 * Generate static map URL for order confirmation emails
 */
export const generateStaticMapUrl = (
  center: Coordinates,
  markers?: Array<{ location: Coordinates; label?: string; color?: string }>,
  zoom: number = 14,
  size: string = '400x300'
): string => {
  let url = `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat},${center.lng}&zoom=${zoom}&size=${size}&key=${API_KEY}`;

  if (markers) {
    markers.forEach(marker => {
      const color = marker.color || 'red';
      const label = marker.label || '';
      url += `&markers=color:${color}|label:${label}|${marker.location.lat},${marker.location.lng}`;
    });
  }

  return url;
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Autocomplete
  getAddressSuggestions,
  getPlaceDetails,

  // Geocoding
  geocodeAddress,
  reverseGeocode,

  // Distance
  calculateDistance,
  calculateDistanceMatrix,

  // Routing
  getDeliveryRoute,
  calculateDeliveryETA,

  // Zone validation
  isInDeliveryZone,
  findNearestWarehouse,

  // Address validation
  validateDeliveryAddress,

  // Static maps
  generateStaticMapUrl,
};
