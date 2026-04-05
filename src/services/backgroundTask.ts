import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchActiveCalls } from './scraper';
import { geocodeAddress } from './geocoder';
import { getDistanceMiles } from './distance';
import { sendNewCallNotification } from './notifications';
import { ActiveCall } from '../types';

const BACKGROUND_TASK_NAME = 'rva-active-calls-fetch';
const KNOWN_CALLS_KEY = 'known_call_ids';
const NOTIFY_RADIUS_MILES = 2;

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    const calls = await fetchActiveCalls();

    // Get known call IDs
    const knownRaw = await AsyncStorage.getItem(KNOWN_CALLS_KEY);
    const knownIds: Set<string> = new Set(knownRaw ? JSON.parse(knownRaw) : []);

    const newCalls = calls.filter((c) => !knownIds.has(c.id));
    if (newCalls.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Get user location
    const loc = await Location.getLastKnownPositionAsync();
    if (!loc) {
      // Replace with current IDs so we don't re-alert later
      await AsyncStorage.setItem(
        KNOWN_CALLS_KEY,
        JSON.stringify(calls.map((c) => c.id))
      );
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    // Check each new call for proximity
    for (const call of newCalls) {
      const coords = await geocodeAddress(call.location);
      if (coords) {
        const dist = getDistanceMiles(
          loc.coords.latitude,
          loc.coords.longitude,
          coords.latitude,
          coords.longitude
        );
        if (dist <= NOTIFY_RADIUS_MILES) {
          call.distanceMiles = dist;
          await sendNewCallNotification(call);
        }
      }
    }

    // Replace known IDs with current active calls (not append) to prevent unbounded growth
    const currentIds = calls.map((c) => c.id);
    await AsyncStorage.setItem(KNOWN_CALLS_KEY, JSON.stringify(currentIds));

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundFetch(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: 60, // iOS will throttle this, but we ask for 60s
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err) {
    console.log('Background fetch registration failed:', err);
  }
}

export async function updateKnownCalls(calls: ActiveCall[]): Promise<void> {
  const ids = calls.map((c) => c.id);
  await AsyncStorage.setItem(KNOWN_CALLS_KEY, JSON.stringify(ids));
}
