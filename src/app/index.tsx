import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LeafletMap, type MapMarker } from '../components/LeafletMap';
import { Wordmark } from '../components/Logo';
import { Btn, Icon } from '../components/ui';
import { createAlert, nameOf } from '../lib/alerts';
import { DEMO_ADDRESS, DEMO_VICTIM } from '../lib/config';
import { reverseGeocode } from '../lib/geo';
import { useMyPosition } from '../lib/location';
import { dismissAlertNotifications, ensureNotificationPermission } from '../lib/notify';
import { useApp } from '../lib/store';
import { C, F, R } from '../lib/theme';

// Static "citizen reports" around the user (pitch: real community reports map).
const REPORT_OFFSETS: { dLat: number; dLng: number; kind: MapMarker['kind'] }[] = [
  { dLat: 0.0042, dLng: -0.0016, kind: 'report-red' },
  { dLat: 0.0018, dLng: 0.0021, kind: 'report-orange' },
  { dLat: -0.0021, dLng: -0.0031, kind: 'report-orange' },
  { dLat: -0.0034, dLng: 0.0029, kind: 'report-red' },
];

export default function Home() {
  const me = useApp((s) => s.me);
  const demoMode = useApp((s) => s.demoMode);
  const walkMode = useApp((s) => s.walkMode);
  const set = useApp((s) => s.set);
  const alerts = useApp((s) => s.alerts);
  const myActive = useApp((s) => s.myActiveAlertId);
  const pos = useMyPosition();
  const [address, setAddress] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    if (!pos) return;
    if (demoMode) return setAddress(DEMO_ADDRESS);
    reverseGeocode(pos).then((a) => a && setAddress(a));
  }, [demoMode, pos && Math.round(pos.lat * 1000), pos && Math.round(pos.lng * 1000)]);

  const center = pos ?? DEMO_VICTIM;
  const markers = useMemo<MapMarker[]>(
    () => [
      ...REPORT_OFFSETS.map((o, i) => ({ id: `r${i}`, lat: center.lat + o.dLat, lng: center.lng + o.dLng, kind: o.kind })),
      { id: 'me', lat: center.lat, lng: center.lng, kind: 'me' as const },
    ],
    [center.lat, center.lng],
  );

  if (!me) return <Redirect href="/login" />;

  // One banner per person (latest open alert), never a pile of duplicates.
  const latestByUser = new Map<string, (typeof alerts)[string]>();
  for (const a of Object.values(alerts)) {
    if (a.user_id === me.id || a.status === 'resolved') continue;
    const cur = latestByUser.get(a.user_id);
    if (!cur || a.created_at > cur.created_at) latestByUser.set(a.user_id, a);
  }
  const incoming = [...latestByUser.values()];

  const onLogoTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      router.push('/demo');
    }
  };

  const sos = async () => {
    setSending(true);
    await createAlert('manual');
    setSending(false);
    router.push('/sent');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Pressable onPress={onLogoTap} hitSlop={10}>
          <Wordmark size={30} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={styles.round} onPress={() => router.push('/settings')}>
            <Icon name="settings-outline" size={22} />
          </Pressable>
          <Pressable style={styles.round} onPress={() => router.push('/circle')}>
            <Text style={styles.initials}>{me.name.slice(0, 2).toUpperCase()}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        <LeafletMap center={center} zoom={15} markers={markers} />

        <View style={styles.overlayTop}>
          {incoming
            .filter((a) => !hidden.includes(a.id))
            .map((a) => {
              const withThem = !!a.arrived_ids?.includes(me.id);
              return (
              <Pressable
                key={a.id}
                style={[styles.incoming, { flexDirection: 'row', alignItems: 'center' }, withThem && { backgroundColor: '#14532D' }]}
                onPress={() => router.push({ pathname: '/alert/[id]', params: { id: a.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.incomingTag}>{withThem ? 'YOU ARE ON SITE' : 'ALERT IN PROGRESS'}</Text>
                  <Text style={styles.incomingTitle}>
                    {withThem ? `You're with ${nameOf(a.user_id)}` : `${nameOf(a.user_id)} needs help — tap`}
                  </Text>
                </View>
                <Pressable
                  hitSlop={12}
                  onPress={() => {
                    setHidden((h) => [...h, a.id]);
                    dismissAlertNotifications(a.id);
                  }}
                >
                  <Icon name="close" size={22} color="#FFE3E3" />
                </Pressable>
              </Pressable>
              );
            })}
          {myActive && (
            <Pressable style={[styles.incoming, { backgroundColor: C.redDark }]} onPress={() => router.push('/sent')}>
              <Text style={styles.incomingTag}>YOUR ALERT IS ACTIVE</Text>
              <Text style={styles.incomingTitle}>See status · Rani labes</Text>
            </Pressable>
          )}
          <View style={styles.pill}>
            <View style={styles.pillDot} />
            <Text style={styles.pillTxt}>4 reports near you</Text>
          </View>
          {demoMode && (
            <View style={[styles.pill, { backgroundColor: 'rgba(47,123,255,0.25)' }]}>
              <Text style={[styles.pillTxt, { fontSize: 12 }]}>DEMO MODE</Text>
            </View>
          )}
        </View>

        <View style={styles.sheet}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.small}>You are at</Text>
              <Text style={styles.addr} numberOfLines={1}>{address ?? 'Locating…'}</Text>
            </View>
            <View style={styles.gps}>
              <Icon name="locate" size={15} color={C.green} />
              <Text style={styles.gpsTxt}>GPS</Text>
            </View>
          </View>

          <View style={styles.walk}>
            <View style={{ flex: 1 }}>
              <Text style={styles.walkTitle}>Walk mode {walkMode ? '· ON' : ''}</Text>
              <Text style={styles.small}>
                {walkMode ? 'Shake protection active — keep najda open' : 'Turn on when walking alone (shake = alert)'}
              </Text>
            </View>
            <Switch
              value={walkMode}
              onValueChange={(v) => set({ walkMode: v })}
              trackColor={{ true: C.red, false: C.border }}
              thumbColor={C.white}
            />
          </View>

          <Btn
            title="SIGNAL"
            icon="alert-circle"
            variant="red"
            big
            loading={sending}
            onPress={() => router.push('/report')}
            onLongPress={sos}
            delayLongPress={3000}
          />
          <Text style={styles.hint}>Long press 3 s = emergency alert</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: C.bg,
  },
  round: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' },
  initials: { color: C.white, fontFamily: F.bold, fontSize: 17 },
  overlayTop: { position: 'absolute', top: 12, left: 14, right: 14, gap: 8, alignItems: 'flex-start' },
  incoming: { alignSelf: 'stretch', backgroundColor: C.red, borderRadius: R.lg, padding: 14 },
  incomingTag: { color: '#FFE3E3', fontFamily: F.bold, fontSize: 11, letterSpacing: 1.2 },
  incomingTitle: { color: C.white, fontFamily: F.title, fontSize: 19, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(35,39,45,0.92)', borderRadius: R.pill, paddingVertical: 8, paddingHorizontal: 14 },
  pillDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.red },
  pillTxt: { color: C.white, fontFamily: F.semi, fontSize: 14 },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    backgroundColor: C.surface,
    borderRadius: 28,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  small: { color: C.grey, fontFamily: F.body, fontSize: 13 },
  addr: { color: C.white, fontFamily: F.title, fontSize: 21, marginTop: 2 },
  gps: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.cardHi, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8 },
  gpsTxt: { color: C.white, fontFamily: F.semi, fontSize: 14 },
  walk: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, padding: 12, gap: 10 },
  walkTitle: { color: C.white, fontFamily: F.bold, fontSize: 16 },
  hint: { color: C.grey, fontFamily: F.body, fontSize: 13, textAlign: 'center' },
});
