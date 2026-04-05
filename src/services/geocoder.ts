import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeocodeCacheEntry, GeocodeCacheMap } from '../types';

const CACHE_KEY = 'geocode_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — addresses don't move
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

let memoryCache: GeocodeCacheMap = {};
let cacheLoaded = false;

async function loadCache(): Promise<void> {
  if (cacheLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      memoryCache = JSON.parse(raw);
      // Evict stale entries
      const now = Date.now();
      for (const key of Object.keys(memoryCache)) {
        if (now - memoryCache[key].cachedAt > CACHE_TTL_MS) {
          delete memoryCache[key];
        }
      }
    }
  } catch {
    memoryCache = {};
  }
  cacheLoaded = true;
}

async function saveCache(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch {
    // Non-critical — cache will rebuild
  }
}

/**
 * Normalize Richmond active-call addresses for geocoding.
 * "3500-BLK CHAMBERLAYNE AVE" → "3500 Chamberlayne Ave, Richmond, VA"
 * "CEDAR ST/E BROAD ST RICH" → "Cedar St & E Broad St, Richmond, VA"
 */
function normalizeAddress(raw: string): string {
  let addr = raw.trim();

  // Remove trailing "RICH" abbreviation
  addr = addr.replace(/\s+RICH$/i, '');

  // Convert block notation: "3500-BLK" → "3500"
  addr = addr.replace(/(\d+)-BLK\b/i, '$1');

  // Convert intersection slash to ampersand
  addr = addr.replace(/\//g, ' & ');

  // Title-case it
  addr = addr
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return `${addr}, Richmond, VA`;
}

/**
 * Parse DMS coordinates embedded in location strings.
 * Format: "LL(-77:25:03.0704,37:31:36.0048): @LIBBY HILL"
 * Returns { latitude, longitude } or null if not a DMS location.
 */
function parseDMSLocation(
  raw: string
): { latitude: number; longitude: number } | null {
  const match = raw.match(
    /LL\(\s*(-?\d+):(\d+):([\d.]+)\s*,\s*(-?\d+):(\d+):([\d.]+)\s*\)/
  );
  if (!match) return null;

  const [, lonDeg, lonMin, lonSec, latDeg, latMin, latSec] = match;

  const lon =
    parseFloat(lonDeg) -
    (parseFloat(lonDeg) < 0 ? 1 : -1) *
      (parseFloat(lonMin) / 60 + parseFloat(lonSec) / 3600);
  const lat =
    parseFloat(latDeg) +
    parseFloat(latMin) / 60 +
    parseFloat(latSec) / 3600;

  // Sanity check — should be in Richmond area
  if (Math.abs(lat - 37.5) > 1 || Math.abs(lon + 77.4) > 1) return null;

  return { latitude: lat, longitude: lon };
}

export async function geocodeAddress(
  rawAddress: string
): Promise<{ latitude: number; longitude: number } | null> {
  await loadCache();

  const cacheKey = rawAddress.toUpperCase().trim();
  const cached = memoryCache[cacheKey];
  if (cached) {
    return { latitude: cached.latitude, longitude: cached.longitude };
  }

  // Check for embedded DMS coordinates first — instant, no API call needed
  const dms = parseDMSLocation(rawAddress);
  if (dms) {
    memoryCache[cacheKey] = { ...dms, cachedAt: Date.now() };
    await saveCache();
    return dms;
  }

  const normalized = normalizeAddress(rawAddress);

  try {
    const params = new URLSearchParams({
      q: normalized,
      format: 'json',
      limit: '1',
      countrycodes: 'us',
    });

    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        'User-Agent': 'RVA-ActiveCalls-App/1.0 (personal use)',
      },
    });

    if (!response.ok) return null;

    const results = await response.json();
    if (!results.length) return null;

    const { lat, lon } = results[0];
    const entry: GeocodeCacheEntry = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      cachedAt: Date.now(),
    };

    memoryCache[cacheKey] = entry;
    await saveCache();

    return { latitude: entry.latitude, longitude: entry.longitude };
  } catch {
    return null;
  }
}

/**
 * Geocode a batch of addresses with a small delay between requests
 * to respect Nominatim's rate limit (1 req/sec).
 */
export async function geocodeBatch(
  addresses: string[]
): Promise<Map<string, { latitude: number; longitude: number }>> {
  await loadCache();

  const results = new Map<string, { latitude: number; longitude: number }>();
  const uncached: string[] = [];

  // Return cached immediately
  for (const addr of addresses) {
    const cacheKey = addr.toUpperCase().trim();
    const cached = memoryCache[cacheKey];
    if (cached) {
      results.set(addr, { latitude: cached.latitude, longitude: cached.longitude });
    } else {
      uncached.push(addr);
    }
  }

  // Geocode uncached with 1-sec delay between requests
  for (const addr of uncached) {
    const result = await geocodeAddress(addr);
    if (result) {
      results.set(addr, result);
    }
    // Nominatim rate limit: 1 request per second
    if (uncached.indexOf(addr) < uncached.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }

  return results;
}
