import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { EAS_PROJECT_ID, isSupabaseConfigured } from './config';
import { supabase } from './supabase';
import { C } from './theme';

export const ALERT_CHANNEL = 'alerts';
const shown = new Set<string>(); // alert ids already notified on this phone (Realtime + push dedup)

export function markShown(alertId: string) {
  shown.add(alertId);
}

export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const id = (n.request.content.data as any)?.alertId as string | undefined;
      const isLocal = n.request.identifier === id;
      // A push arriving after the Realtime local notification for the same alert is hidden.
      const dup = !!id && !isLocal && shown.has(id);
      if (id) shown.add(id);
      return {
        shouldShowBanner: !dup,
        shouldShowList: !dup,
        shouldPlaySound: !dup,
        shouldSetBadge: false,
      };
    },
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
      name: 'najda alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 200, 600, 200, 600],
      lightColor: C.red,
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.status === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Registers this phone's Expo push token on the user row. Silently skipped if not possible. */
export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice || !EAS_PROJECT_ID || !isSupabaseConfigured) return null;
    if (!(await ensureNotificationPermission())) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
    await supabase.from('users').update({ push_token: token }).eq('id', userId);
    return token;
  } catch (e) {
    console.log('[push] token registration skipped:', String(e));
    return null;
  }
}

/** Remove every tray notification about this alert (local, push and "is safe" ones). */
export async function dismissAlertNotifications(alertId: string) {
  // Direct hit on the local notification's identifier (works even if listing fails).
  await Notifications.dismissNotificationAsync(alertId).catch(() => {});
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) => {
          const c = n.request.content;
          // Push notifications may carry the id in data, or only in the raw FCM payload.
          const raw = JSON.stringify((n.request.trigger as any)?.remoteMessage ?? {});
          return (c.data as any)?.alertId === alertId || n.request.identifier.startsWith(alertId) || raw.includes(alertId);
        })
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    // ignore
  }
}

export async function dismissAllNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // ignore
  }
}

export async function showLocalAlert(alertId: string, title: string, body: string) {
  if (shown.has(alertId)) return;
  shown.add(alertId);
  await Notifications.scheduleNotificationAsync({
    identifier: alertId,
    content: {
      title,
      body,
      data: { alertId },
      sound: 'default',
      color: C.red,
      priority: Notifications.AndroidNotificationPriority.MAX,
      autoDismiss: true, // tapping removes it
      sticky: false, // can always be swiped away
    },
    trigger: Platform.OS === 'android' ? { channelId: ALERT_CHANNEL } : null,
  });
}

export async function showInfo(id: string, title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, data: { alertId: id.split(':')[0] }, color: C.green, autoDismiss: true, sticky: false },
    trigger: Platform.OS === 'android' ? { channelId: ALERT_CHANNEL } : null,
  });
}

/** Expo Push Service (free). Works when the receiver's app is killed (needs FCM configured in EAS). */
export async function sendPush(
  tokens: string[],
  msg: { title: string; body: string; data: Record<string, unknown> },
) {
  const to = tokens.filter((t) => t?.startsWith('ExponentPushToken') || t?.startsWith('ExpoPushToken'));
  if (!to.length) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(
        to.map((t) => ({ to: t, ...msg, sound: 'default', priority: 'high', channelId: ALERT_CHANNEL })),
      ),
    });
  } catch (e) {
    console.log('[push] send failed:', String(e));
  }
}
