import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { heartbeat, loadMembers, notifyIncoming, notifySafe } from '../lib/alerts';
import { isSupabaseConfigured } from '../lib/config';
import { dismissAlertNotifications, registerPushToken } from '../lib/notify';
import { useShakeDetector } from '../lib/shake';
import { SENSITIVITY_G, getApp, useApp } from '../lib/store';
import { supabase, type AlertRow } from '../lib/supabase';

/** Global background behaviour while the app is open: shake detection, circle Realtime, taps. */
export function Watchers() {
  const me = useApp((s) => s.me);
  const offline = useApp((s) => s.offline);
  const walkMode = useApp((s) => s.walkMode);
  const checkOpen = useApp((s) => s.checkOpen);
  const myActive = useApp((s) => s.myActiveAlertId);
  const sensitivity = useApp((s) => s.sensitivity);
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // 1. Shake → "labes?" check (only in Walk mode, not during an alert).
  useShakeDetector(!!me && walkMode && !checkOpen && !myActive, SENSITIVITY_G[sensitivity], () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    getApp().set({ checkOpen: true });
    router.push('/check');
  });

  // 2. Keep the screen awake in Walk mode so the accelerometer keeps running.
  useEffect(() => {
    if (!walkMode) return;
    activateKeepAwakeAsync('walk').catch(() => {});
    return () => {
      deactivateKeepAwake('walk').catch(() => {});
    };
  }, [walkMode]);

  // 3. Profile: push token, members, heartbeat.
  useEffect(() => {
    if (!me || offline || !isSupabaseConfigured) return;
    registerPushToken(me.id);
    loadMembers();
    heartbeat();
    const t = setInterval(heartbeat, 60_000);
    return () => clearInterval(t);
  }, [me?.id, me?.circle_id, offline]);

  // 4. Realtime: alerts of my circle → red notification; updates → store; member changes.
  useEffect(() => {
    if (!me?.circle_id || offline || !isSupabaseConfigured) return;
    const circle = me.circle_id;
    const ch = supabase
      .channel(`circle-${circle}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', filter: `circle_id=eq.${circle}` }, (p) => {
        const row = p.new as AlertRow;
        getApp().upsertAlert(row);
        if (row.user_id !== getApp().me?.id) notifyIncoming(row);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts', filter: `circle_id=eq.${circle}` }, (p) => {
        const row = p.new as AlertRow;
        const prev = getApp().alerts[row.id];
        getApp().upsertAlert(row);
        if (row.status === 'resolved' && prev && prev.status !== 'resolved' && row.user_id !== getApp().me?.id) {
          // Replace the red alert in the tray with the green "is safe" one.
          dismissAlertNotifications(row.id).then(() => notifySafe(row));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `circle_id=eq.${circle}` }, () => {
        loadMembers();
      })
      .subscribe();

    // Catch alerts sent while this phone was offline/closed (last 30 min).
    supabase
      .from('alerts')
      .select('*')
      .eq('circle_id', circle)
      .neq('status', 'resolved')
      .gte('created_at', new Date(Date.now() - 30 * 60_000).toISOString())
      .then(({ data }) => (data as AlertRow[] | null)?.forEach((a) => getApp().upsertAlert(a)));

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me?.circle_id, offline]);

  // 4b. Victim side: my alert was closed elsewhere (a helper arrived) -> leave "alert mode".
  //     On /silent and /sent the AlertClosed screen handles it; anywhere else, clear it now.
  const myAlertStatus = useApp((s) => (s.myActiveAlertId ? s.alerts[s.myActiveAlertId]?.status : undefined));
  useEffect(() => {
    if (myAlertStatus !== 'resolved') return;
    if (pathname === '/silent' || pathname === '/sent') return;
    getApp().set({ myActiveAlertId: null });
  }, [myAlertStatus, pathname]);

  // 5. Notification tap → helper map (or my own silent screen).
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const id = (last?.notification.request.content.data as any)?.alertId as string | undefined;
    if (!id || !getApp().me) return;
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
    // Small delay so the navigator is mounted when the app was cold-started by the tap.
    const t = setTimeout(() => {
      if (id === getApp().myActiveAlertId) {
        if (pathRef.current !== '/silent') router.push('/silent');
        return;
      }
      const target = `/alert/${id}`;
      if (pathRef.current === target) return; // already showing it
      // Swap alert screens instead of stacking a second map on top of the first.
      if (pathRef.current.startsWith('/alert/')) router.replace({ pathname: '/alert/[id]', params: { id } });
      else router.push({ pathname: '/alert/[id]', params: { id } });
    }, 400);
    return () => clearTimeout(t);
  }, [last]);

  return null;
}
