import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LeafletMap, type MapMarker } from '../../components/LeafletMap';
import { Btn, Icon } from '../../components/ui';
import { ALERT_LABEL, arriveAlert, nameOf, respondAlert } from '../../lib/alerts';
import { dismissAlertNotifications } from '../../lib/notify';
import { DEMO_HELPER, DEMO_PROFILES } from '../../lib/config';
import { fetchRoute, formatDistance, haversine, remainingRoute, runEtaMinutes, type LatLng, type Route } from '../../lib/geo';
import { useMyPosition } from '../../lib/location';
import { useApp } from '../../lib/store';
import { useAlert } from '../../lib/useAlert';
import { C, F, R } from '../../lib/theme';

const DEMO_RUN_SECONDS = 35; // in demo mode the helper "runs" 350 m in ~35 s on stage

function pointAlong(points: LatLng[], t: number): LatLng {
  if (points.length < 2) return points[0];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    seg.push(d);
    total += d;
  }
  let target = total * Math.min(1, Math.max(0, t));
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? Math.min(1, target / seg[i]) : 1;
      const a = points[i];
      const b = points[i + 1];
      return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
    }
    target -= seg[i];
  }
  return points[points.length - 1];
}

function helpersLine(onWay: string[], there: string[], victim: string, myName?: string): string {
  const you = (n: string) => (n === myName ? 'You' : n);
  const parts: string[] = [];
  if (there.length) parts.push(`${there.map(you).join(' and ')} ${there.length > 1 || there[0] === myName ? 'are' : 'is'} with ${victim}`);
  if (onWay.length) parts.push(`${onWay.map(you).join(' and ')} ${onWay.length > 1 || onWay[0] === myName ? 'are' : 'is'} on the way`);
  return parts.join(' · ');
}

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
}

/** Helper view: "Mariem needs help" — last position, route, distance, ETA, I'm going. */
export default function AlertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const alert = useAlert(id);
  const me = useApp((s) => s.me);
  const members = useApp((s) => s.members);
  const demoMode = useApp((s) => s.demoMode);
  const myPos = useMyPosition();
  const [route, setRoute] = useState<Route | null>(null);
  const [now, setNow] = useState(Date.now());
  const [goingAt, setGoingAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const startRef = useRef<LatLng | null>(null);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Opening the alert clears its notification from the tray.
  useEffect(() => {
    if (id) dismissAlertNotifications(id);
  }, [id]);

  const target = alert?.lat != null && alert?.lng != null ? { lat: alert.lat, lng: alert.lng } : null;

  // Route computed once from where I was when I opened the alert.
  useEffect(() => {
    if (!target || !myPos || startRef.current) return;
    startRef.current = demoMode ? DEMO_HELPER : { lat: myPos.lat, lng: myPos.lng };
    fetchRoute(startRef.current, target).then(setRoute);
  }, [target?.lat, target?.lng, myPos?.lat]);

  const iAmGoing = !!me && !!alert?.responder_ids.includes(me.id);
  useEffect(() => {
    if (iAmGoing && !goingAt) setGoingAt(Date.now());
  }, [iAmGoing]);

  // My position: real GPS, or (demo) simulated running along the route.
  const helperPos: LatLng | null = useMemo(() => {
    if (demoMode && route) {
      const t = goingAt ? (now - goingAt) / 1000 / DEMO_RUN_SECONDS : 0;
      return pointAlong(route.points, t);
    }
    return myPos ? { lat: myPos.lat, lng: myPos.lng } : null;
  }, [demoMode, route, goingAt, now, myPos?.lat, myPos?.lng]);

  const distance = useMemo(() => {
    if (!helperPos || !target) return null;
    const straight = haversine(helperPos, target);
    if (!route || !startRef.current) return straight;
    // Scale the straight-line distance by the route's detour factor.
    const factor = route.distance / Math.max(1, haversine(startRef.current, target));
    return straight * Math.max(1, factor);
  }, [helperPos, target, route]);

  if (!alert) {
    const giveUp = now - openedAt.current > 8000;
    return (
      <SafeAreaView style={[styles.full, { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }]}>
        {giveUp ? (
          <>
            <Text style={[styles.h2, { textAlign: 'center' }]}>This alert is no longer available</Text>
            <Text style={[styles.sub, { textAlign: 'center' }]}>It may have been closed, or the connection is down.</Text>
            <Btn title="Back home" style={{ alignSelf: 'stretch' }} onPress={() => router.replace('/')} />
          </>
        ) : (
          <ActivityIndicator color={C.red} />
        )}
      </SafeAreaView>
    );
  }

  const victimName = nameOf(alert.user_id);
  const victimPhone =
    members.find((m) => m.id === alert.user_id)?.phone ?? DEMO_PROFILES.find((p) => p.id === alert.user_id)?.phone;
  const arrivedIds = alert.arrived_ids ?? [];
  const responders = alert.responder_ids.filter((r) => !arrivedIds.includes(r)).map(nameOf);
  const arrivedNames = arrivedIds.map(nameOf);
  const iAmThere = !!me && arrivedIds.includes(me.id);

  if (alert.status === 'resolved') {
    return (
      <SafeAreaView style={[styles.full, { backgroundColor: C.greenDark, padding: 24, justifyContent: 'center' }]}>
        <View style={styles.safeIcon}>
          <Icon name="checkmark" size={56} color="#000" />
        </View>
        <Text style={[styles.bannerTitle, { textAlign: 'center', marginTop: 12 }]}>{victimName} is safe</Text>
        <Text style={[styles.sub, { textAlign: 'center', marginTop: 8 }]}>
          Rani labes — the alert is closed and the location was deleted.
        </Text>
        <Btn title="Back home" variant="green" style={{ marginTop: 32 }} onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  const markers: MapMarker[] = [];
  if (target) markers.push({ id: 'v', ...target, kind: 'victim', initial: victimName[0], label: `${victimName} · ${ago(alert.created_at, now)}` });
  if (helperPos) markers.push({ id: 'me', ...helperPos, kind: 'me', label: `You (${me?.name ?? 'me'})` });
  const arrived = iAmThere || (distance != null && distance < 25);

  return (
    <View style={styles.full}>
      <LeafletMap
        center={target ?? helperPos ?? DEMO_HELPER}
        markers={markers}
        route={route && helperPos ? remainingRoute(route.points, helperPos) : undefined}
        fit
      />
      <SafeAreaView edges={['top']} style={{ paddingHorizontal: 14 }}>
        <View style={styles.banner}>
          <Text style={styles.bannerTag}>ALERT IN PROGRESS · {ALERT_LABEL[alert.type].split(' —')[0].toUpperCase()}</Text>
          <Text style={styles.bannerTitle}>{victimName} needs help</Text>
        </View>
      </SafeAreaView>

      <View style={styles.sheet}>
        <View style={styles.grab} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{victimName[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.h2} numberOfLines={1}>{victimName}'s last position</Text>
            <Text style={styles.sub} numberOfLines={1}>{alert.address ?? 'Locating address…'} · GPS ±5 m</Text>
          </View>
        </View>

        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.tileLbl}>DISTANCE</Text>
            <Text style={styles.tileVal}>{distance == null ? '—' : formatDistance(distance)}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLbl}>RUNNING</Text>
            <Text style={styles.tileVal}>{distance == null ? '—' : arrived ? 'Arrived' : `≈ ${runEtaMinutes(distance)} min`}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLbl}>HELPERS</Text>
            <Text style={[styles.tileVal, { color: alert.responder_ids.length ? C.green : C.white }]}>{alert.responder_ids.length}</Text>
          </View>
        </View>

        {(responders.length > 0 || arrivedNames.length > 0) && (
          <Text style={[styles.sub, { color: C.green, marginBottom: 10 }]}>{helpersLine(responders, arrivedNames, victimName, me?.name)}</Text>
        )}

        {iAmThere ? (
          <View style={styles.withCard}>
            <Icon name="people" size={22} color={C.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.withTitle}>You're with {victimName}</Text>
              <Text style={styles.sub}>Stay together. Only {victimName} can close the alert, with the secret code.</Text>
            </View>
          </View>
        ) : iAmGoing ? (
          <>
            <Btn
              title={`I'm with ${victimName}`}
              icon="checkmark-circle"
              variant="green"
              big
              loading={busy}
              onPress={async () => {
                setBusy(true);
                await arriveAlert(alert.id);
                await dismissAlertNotifications(alert.id);
                setBusy(false);
                router.replace('/');
              }}
            />
            {!demoMode && target && (
              <Btn
                title="Open walking route in Maps"
                icon="map-outline"
                variant="ghost"
                style={{ marginTop: 10, minHeight: 48 }}
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=walking`,
                  )
                }
              />
            )}
          </>
        ) : (
          <Btn
            title="I'm going — Route"
            icon="navigate"
            variant="blue"
            big
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setGoingAt(Date.now());
              await respondAlert(alert.id);
              dismissAlertNotifications(alert.id);
              setBusy(false);
            }}
          />
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Btn
            title={`Call ${victimName}`}
            icon="call-outline"
            style={{ flex: 1 }}
            onPress={() => victimPhone && Linking.openURL(`tel:${victimPhone}`)}
          />
          <Btn
            title="Call 197"
            icon="shield-outline"
            style={{ flex: 1 }}
            textStyle={{ color: C.red }}
            onPress={() => Linking.openURL('tel:197')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: C.bg },
  withCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.greenDark, borderRadius: R.lg, padding: 16, borderWidth: 1, borderColor: C.green },
  withTitle: { color: C.white, fontFamily: F.bold, fontSize: 17 },
  safeIcon: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  banner: {
    backgroundColor: C.red,
    borderRadius: R.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 8,
    shadowColor: C.red,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  bannerTag: { color: '#FFE3E3', fontFamily: F.bold, fontSize: 12, letterSpacing: 1.2 },
  bannerTitle: { color: C.white, fontFamily: F.title, fontSize: 26, marginTop: 2 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    paddingBottom: 30,
  },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.white, fontFamily: F.title, fontSize: 24 },
  h2: { color: C.white, fontFamily: F.title, fontSize: 19 },
  sub: { color: C.grey, fontFamily: F.body, fontSize: 14, marginTop: 2 },
  tiles: { flexDirection: 'row', gap: 8, marginVertical: 14 },
  tile: { flex: 1, backgroundColor: C.card, borderRadius: R.md, padding: 12 },
  tileLbl: { color: C.grey, fontFamily: F.semi, fontSize: 11, letterSpacing: 0.8 },
  tileVal: { color: C.white, fontFamily: F.title, fontSize: 20, marginTop: 4 },
});
