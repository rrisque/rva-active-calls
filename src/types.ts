export interface ActiveCall {
  id: string;
  timeReceived: string;
  agency: 'RPD' | 'RFD' | string;
  dispatchArea: string;
  unit: string;
  callType: string;
  location: string;
  status: 'Dispatched' | 'Enroute' | 'Arrived' | string;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
}

export interface GeocodeCacheEntry {
  latitude: number;
  longitude: number;
  cachedAt: number;
}

export type GeocodeCacheMap = Record<string, GeocodeCacheEntry>;
