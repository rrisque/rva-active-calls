import { ActiveCall } from '../types';

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function sendNewCallNotification(call: ActiveCall): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const distance = call.distanceMiles
    ? `${call.distanceMiles.toFixed(1)} mi away`
    : 'Nearby';

  new Notification(`${call.agency} — ${call.callType}`, {
    body: `${call.location} (${distance}) • ${call.status}`,
  });
}
