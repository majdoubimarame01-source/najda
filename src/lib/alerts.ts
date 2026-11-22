import * as Battery from 'expo-battery';
import { DEMO_ADDRESS, DEMO_PROFILES, DEMO_VICTIM, isSupabaseConfigured } from './config';
import { formatDistance, haversine, reverseGeocode, withTimeout } from './geo';
import { getMyPosition } from './location';
import { sendPush, showInfo, showLocalAlert } from './notify';
import { getApp } from './store';
import { supabase, type AlertRow, type AlertType, type Profile } from './supabase';

export const ALERT_LABEL: Record<AlertType, string> = {
  braquage: 'Robbery / Theft',
  harcelement: 'Followed / Harassed',
  agression: 'Assault',
  accident: 'Accident',
  medical: 'Medical emergency',
  autre: 'Other danger',
  shake_no_code: 'Possible robbery — phone grabbed, no code',
  manual: 'Emergency (SOS)',
};

const online = () => isSupabaseConfigured && !getApp().offline;
export const isLocalId = (id: string) => id.startsWith('local-');

export function nameOf(userId: string): string {
  const { me, members } = getApp();
  if (me?.id === userId) return me.name;
  return (
    members.find((m) => m.id === userId)?.name ??
    DEMO_PROFILES.find((p) => p.id === userId)?.name ??
    'Someone'
  );
}

export async function loadMembers(): Promise<Profile[]> {
  const { me } = getApp();
  if (!me?.circle_id || !online()) return getApp().members;
  try {
    const { data } = await withTimeout(
      Promise.resolve(
        supabase.from('users').select('id,name,phone,circle_id,push_token,battery,last_seen').eq('circle_id', me.circle_id),
      ),
      5000,
    );
    if (data) getApp().set({ members: data as Profile[] });
    return (data as Profile[]) ?? [];
  } catch {
    return getApp().members;
  }
}

/** Sends an alert to the circle. Never throws: falls back to a local alert + background retry. */
export async function createAlert(type: AlertType): Promise<AlertRow> {
  const { me, demoMode, myActiveAlertId, alerts } = getApp();
  if (!me) throw new Error('not logged in');
  // Never stack alerts: while one is open, every new trigger reuses it.
  const open = myActiveAlertId ? alerts[myActiveAlertId] : null;
  if (open && open.status !== 'resolved') return open;
  if (creating) return creating;
  creating = doCreate(type, me, demoMode).finally(() => {
    creating = null;
  });
  return creating;
}

let creating: Promise<AlertRow> | null = null;

async function doCreate(type: AlertType, me: Profile, demoMode: boolean): Promise<AlertRow> {
  const pos = await getMyPosition();
  const draft = {
    user_id: me.id,
    circle_id: me.circle_id,
    type,
    status: 'active' as const,
    lat: pos.lat,
    lng: pos.lng,
    address: demoMode ? DEMO_ADDRESS : null,
  };

  const local: AlertRow = {
    ...draft,
    id: `local-${Date.now()}`,
    created_at: new Date().toISOString(),
    resolved_at: null,
    responder_ids: [],
  };
  getApp().upsertAlert(local);
  getApp().set({ myActiveAlertId: local.id });

  if (!online()) return local;

  const insert = async (): Promise<AlertRow | null> => {
    try {
      const { data, error } = await withTimeout(
        Promise.resolve(supabase.from('alerts').insert(draft).select().single()),
        6000,
      );
      if (error || !data) return null;
      return data as AlertRow;
    } catch {
      return null;
    }
  };

  let row = await insert();
  if (!row) {
    // Retry in background (bad network on stage); screens follow myActiveAlertId.
    (async () => {
      for (let i = 0; i < 10 && !row; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        if (getApp().myActiveAlertId !== local.id) return; // resolved meanwhile
        row = await insert();
      }
      if (row) afterInsert(row, local.id);
    })();
    return local;
  }
  afterInsert(row, local.id);
  return row;
}

function afterInsert(row: AlertRow, localId: string) {
  const app = getApp();
  app.upsertAlert(row);
  if (app.myActiveAlertId === localId) app.set({ myActiveAlertId: row.id });
  void notifyCircle(row);
  if (!row.address && row.lat != null && row.lng != null) {
    void reverseGeocode({ lat: row.lat, lng: row.lng }).then(async (address) => {
      if (!address) return;
      getApp().upsertAlert({ ...row, address });
      await supabase.from('alerts').update({ address }).eq('id', row.id);
    });
  }
}

async function notifyCircle(row: AlertRow) {
  const { me } = getApp();
  const members = await loadMembers();
  const tokens = members.filter((m) => m.id !== me?.id && m.push_token).map((m) => m.push_token!) ;
  await sendPush(tokens, {
    title: `🚨 ${me?.name ?? 'Someone'} is in danger`,
    body: `${ALERT_LABEL[row.type]} · ${row.address ?? 'Tap to see the last position'}`,
    data: { alertId: row.id },
  });
}

export async function fetchAlert(id: string): Promise<AlertRow | null> {
  const cached = getApp().alerts[id];
  if (isLocalId(id) || !online()) return cached ?? null;
  try {
    const { data } = await withTimeout(
      Promise.resolve(supabase.from('alerts').select('*').eq('id', id).single()),
      5000,
    );
    if (data) getApp().upsertAlert(data as AlertRow);
    return (data as AlertRow) ?? cached ?? null;
  } catch {
    return cached ?? null;
  }
}

export async function respondAlert(id: string) {
  const { me } = getApp();
  if (!me) return;
  const cur = getApp().alerts[id];
  if (cur) {
    const ids = cur.responder_ids.includes(me.id) ? cur.responder_ids : [...cur.responder_ids, me.id];
    getApp().upsertAlert({ ...cur, responder_ids: ids, status: cur.status === 'active' ? 'responding' : cur.status });
  }
  if (isLocalId(id) || !online()) return;
  const { data } = await supabase.rpc('respond_alert', { p_alert: id, p_user: me.id });
  if (data) getApp().upsertAlert(data as AlertRow);
}

/** Helper reached the victim ("I'm with Mariem"). Also counts as responding. */
export async function arriveAlert(id: string) {
  const { me } = getApp();
  if (!me) return;
  const cur = getApp().alerts[id];
  if (cur) {
    const add = (ids: string[] | undefined) => (ids?.includes(me.id) ? ids : [...(ids ?? []), me.id]);
    getApp().upsertAlert({
      ...cur,
      responder_ids: add(cur.responder_ids),
      arrived_ids: add(cur.arrived_ids),
      status: cur.status === 'active' ? 'responding' : cur.status,
    });
  }
  if (isLocalId(id) || !online()) return;
  const { data } = await supabase.rpc('arrive_alert', { p_alert: id, p_user: me.id });
  if (data) getApp().upsertAlert(data as AlertRow);
}

export async function resolveAlert(id: string) {
  const { me } = getApp();
  const cur = getApp().alerts[id];
  if (cur) {
    getApp().upsertAlert({ ...cur, status: 'resolved', lat: null, lng: null, resolved_at: new Date().toISOString() });
  }
  getApp().set({ myActiveAlertId: null });
  // Close every other open alert of mine too (e.g. a duplicate from a double trigger).
  for (const a of Object.values(getApp().alerts)) {
    if (a.user_id === me?.id && a.status !== 'resolved' && a.id !== id) {
      getApp().upsertAlert({ ...a, status: 'resolved', lat: null, lng: null });
    }
  }
  if (isLocalId(id) || !online()) return;
  try {
    await supabase.rpc('resolve_alert', { p_alert: id });
    if (me) {
      await supabase
        .from('alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), lat: null, lng: null, address: null })
        .eq('user_id', me.id)
        .neq('status', 'resolved');
    }
    const members = getApp().members;
    await sendPush(
      members.filter((m) => m.id !== me?.id && m.push_token).map((m) => m.push_token!),
      { title: `✅ ${me?.name ?? 'Your contact'} is safe`, body: 'Rani labes — alert closed.', data: { alertId: id } },
    );
  } catch {
    // best effort
  }
}

/** Demo-mode helper: resolve every open alert of mine on the server. */
export async function resetMyAlerts() {
  const { me } = getApp();
  getApp().set({ myActiveAlertId: null, alerts: {} });
  if (!me || !online()) return;
  await supabase
    .from('alerts')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), lat: null, lng: null, address: null })
    .eq('user_id', me.id)
    .neq('status', 'resolved');
}

/** Offline fallback for the stage demo: simulate Mariem's alert arriving on this phone. */
export async function triggerLocalDemoAlert(): Promise<string> {
  const victim = DEMO_PROFILES[0];
  const row: AlertRow = {
    id: `local-demo-${Date.now()}`,
    user_id: victim.id,
    circle_id: getApp().me?.circle_id ?? null,
    type: 'shake_no_code',
    status: 'active',
    lat: DEMO_VICTIM.lat,
    lng: DEMO_VICTIM.lng,
    address: DEMO_ADDRESS,
    created_at: new Date().toISOString(),
    resolved_at: null,
    responder_ids: [],
  };
  getApp().upsertAlert(row);
  await notifyIncoming(row);
  return row.id;
}

/** Receiver side: red notification with the distance from THIS phone. */
export async function notifyIncoming(row: AlertRow) {
  // One live alert per person: if this person already has an open alert we notified, stay quiet.
  const dup = Object.values(getApp().alerts).some(
    (a) => a.id !== row.id && a.user_id === row.user_id && a.status !== 'resolved' &&
      Date.now() - new Date(a.created_at).getTime() < 2 * 60_000,
  );
  if (dup) return;
  const name = nameOf(row.user_id);
  let distTxt = '';
  if (row.lat != null && row.lng != null) {
    const me = await getMyPosition();
    distTxt = ` — ${formatDistance(haversine(me, { lat: row.lat, lng: row.lng }))} from you`;
  }
  await showLocalAlert(row.id, `🚨 ${name} is in danger${distTxt}`, `${ALERT_LABEL[row.type]} · tap to see the last position`);
}

const lastSafe = new Map<string, number>();

export async function notifySafe(row: AlertRow) {
  // Closing several alerts at once must give one "safe" notification, not one per alert.
  const prev = lastSafe.get(row.user_id) ?? 0;
  if (Date.now() - prev < 15_000) return;
  lastSafe.set(row.user_id, Date.now());
  await showInfo(`${row.id}:safe`, `✅ ${nameOf(row.user_id)} is safe`, 'Rani labes — alert closed.');
}

export async function heartbeat() {
  const { me } = getApp();
  if (!me || !online()) return;
  let battery: number | null = null;
  try {
    const lvl = await Battery.getBatteryLevelAsync();
    if (lvl >= 0) battery = Math.round(lvl * 100);
  } catch {
    // ignore
  }
  await supabase.from('users').update({ battery, last_seen: new Date().toISOString() }).eq('id', me.id);
}
