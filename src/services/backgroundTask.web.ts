import { ActiveCall } from '../types';

export async function registerBackgroundFetch(): Promise<void> {
  // Background fetch not available on web
}

export async function updateKnownCalls(_calls: ActiveCall[]): Promise<void> {
  // No-op on web
}
