import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ActiveCall } from '../types';

// Show notifications even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function sendNewCallNotification(call: ActiveCall): Promise<void> {
  const distance = call.distanceMiles
    ? `${call.distanceMiles.toFixed(1)} mi away`
    : 'Nearby';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${call.agency} — ${call.callType}`,
      body: `${call.location} (${distance}) • ${call.status}`,
      data: { callId: call.id },
      ...(Platform.OS === 'android' && {
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    },
    trigger: null,
  });
}
