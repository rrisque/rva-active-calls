import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { ActiveCall } from '../types';
import { fetchActiveCalls } from '../services/scraper';
import { geocodeAddress } from '../services/geocoder';
import { getDistanceMiles } from '../services/distance';
import { updateKnownCalls } from '../services/backgroundTask';
import { sendNewCallNotification } from '../services/notifications';

const POLL_INTERVAL_MS = 45_000;
const NOTIFY_RADIUS_MILES = 2;

export function useActiveCalls() {
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  function enrichAndSort(
    rawCalls: ActiveCall[],
    loc: Location.LocationObject | null
  ): ActiveCall[] {
    const enriched = rawCalls.map((call) => {
      const c = { ...call };
      if (c.latitude != null && c.longitude != null && loc) {
        c.distanceMiles = getDistanceMiles(
          loc.coords.latitude,
          loc.coords.longitude,
          c.latitude,
          c.longitude
        );
      }
      return c;
    });

    return enriched;
  }

  async function refresh() {
    try {
      if (!isFirstLoad.current) {
        setRefreshing(true);
      }
      setError(null);

      console.log('[RVA] Fetching active calls...');
      const rawCalls = await fetchActiveCalls();
      console.log(`[RVA] Got ${rawCalls.length} calls`);

      // Show calls immediately (without geocoding) so user sees data fast
      setCalls(rawCalls);
      setLoading(false);
      setLastUpdated(new Date());
      isFirstLoad.current = false;

      // Get user location (non-blocking — timeout after 5s)
      let loc: Location.LocationObject | null = null;
      try {
        loc = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (loc) setUserLocation(loc);
      } catch {
        try {
          loc = await Location.getLastKnownPositionAsync();
          if (loc) setUserLocation(loc);
        } catch {}
      }

      // Geocode in batches — update UI every 5 addresses to avoid
      // rapid re-renders that crash react-native-maps
      const uniqueAddresses = [...new Set(rawCalls.map((c) => c.location))];
      console.log(`[RVA] Geocoding ${uniqueAddresses.length} unique addresses...`);

      let currentCalls = [...rawCalls];
      let pendingUpdates = 0;

      for (let i = 0; i < uniqueAddresses.length; i++) {
        const addr = uniqueAddresses[i];
        const coords = await geocodeAddress(addr);
        if (coords) {
          currentCalls = currentCalls.map((c) =>
            c.location === addr
              ? { ...c, latitude: coords.latitude, longitude: coords.longitude }
              : c
          );
          pendingUpdates++;
        }

        // Flush to UI every 5 addresses or at the end
        if (pendingUpdates >= 5 || i === uniqueAddresses.length - 1) {
          setCalls(enrichAndSort(currentCalls, loc));
          pendingUpdates = 0;
        }
      }

      console.log('[RVA] Geocoding complete');

      // Detect new nearby calls for foreground notifications
      const finalCalls = enrichAndSort(currentCalls, loc);
      const newCalls = finalCalls.filter((c) => !knownIdsRef.current.has(c.id));
      if (knownIdsRef.current.size > 0) {
        for (const call of newCalls) {
          if (call.distanceMiles != null && call.distanceMiles <= NOTIFY_RADIUS_MILES) {
            await sendNewCallNotification(call);
          }
        }
      }

      knownIdsRef.current = new Set(finalCalls.map((c) => c.id));
      await updateKnownCalls(finalCalls);
      setCalls(finalCalls);
    } catch (err: any) {
      console.log('[RVA] Error:', err.message);
      setError(err.message || 'Failed to fetch calls');
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return { calls, userLocation, loading, refreshing, error, lastUpdated, refresh };
}
