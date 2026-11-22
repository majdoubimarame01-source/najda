import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Icon, type IconName } from '../components/ui';
import { createAlert } from '../lib/alerts';
import { DEMO_ADDRESS, SIMULATED_NEARBY_USERS } from '../lib/config';
import { useApp } from '../lib/store';
import type { AlertType } from '../lib/supabase';
import { C, F, R } from '../lib/theme';

const TYPES: { type: AlertType; icon: IconName; label: string }[] = [
// Only personal threats a friend can act on (come, call, bring help).
  { type: 'braquage', icon: 'hand-left-outline', label: 'Robbery / Theft' },
  { type: 'harcelement', icon: 'eye-outline', label: 'Followed / Harassed' },
  { type: 'agression', icon: 'flash-outline', label: 'Assault' },
  { type: 'accident', icon: 'car-outline', label: 'Accident' },
  { type: 'medical', icon: 'medkit-outline', label: 'Medical emergency' },
  { type: 'autre', icon: 'alert-circle-outline', label: 'Other danger' },
];

/** "What's happening?" — report grid (manual SIGNAL flow). */
export default function Report() {
  const [type, setType] = useState<AlertType>('braquage');
  const [sending, setSending] = useState(false);
  const members = useApp((s) => s.members);
  const me = useApp((s) => s.me);
  const demoMode = useApp((s) => s.demoMode);
  const contacts = members.filter((m) => m.id !== me?.id).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28, gap: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.h1}>What's happening?</Text>

        <View style={styles.grid}>
          {TYPES.map((t) => {
            const on = t.type === type;
            return (
              <Pressable
                key={t.type}
                onPress={() => setType(t.type)}
                style={[styles.tile, on && { borderColor: C.red, backgroundColor: '#2A1214' }]}
              >
                <Icon name={t.icon} size={26} color={on ? C.red : C.text2} />
                <Text style={styles.tileTxt}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.info}>
          <View style={styles.redDot} />
          <View>
            <Text style={styles.infoLbl}>Position</Text>
            <Text style={styles.infoVal}>{demoMode ? DEMO_ADDRESS : 'Current GPS position'} · ±5 m</Text>
          </View>
        </View>
        <View style={styles.info}>
          <Icon name="camera-outline" size={22} color={C.grey} />
          <View>
            <Text style={styles.infoLbl}>Proof (coming soon)</Text>
            <Text style={[styles.infoVal, { color: C.grey }]}>Photo · 8 s video</Text>
          </View>
        </View>
        <View style={styles.info}>
          <Icon name="people-outline" size={22} color={C.text2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLbl}>Sent to</Text>
            <Text style={styles.infoVal}>
              Trusted circle ({contacts}) · {SIMULATED_NEARBY_USERS} nearby najda users
            </Text>
          </View>
        </View>

        <Btn
          title="SEND ALERT"
          variant="red"
          big
          loading={sending}
          style={{ marginTop: 6 }}
          onPress={async () => {
            setSending(true);
            await createAlert(type);
            router.replace('/sent');
          }}
        />
        <Text style={styles.anon}>Your circle gets your position and can come or call for help.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { color: C.grey, fontFamily: F.medium, fontSize: 17 },
  h1: { color: C.white, fontFamily: F.title, fontSize: 30, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: {
    width: '48.5%',
    height: 96,
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 2,
    borderColor: C.border,
    padding: 16,
    justifyContent: 'space-between',
  },
  tileTxt: { color: C.white, fontFamily: F.bold, fontSize: 15 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: R.lg, padding: 16 },
  redDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.red, borderWidth: 5, borderColor: '#4A1012' },
  infoLbl: { color: C.grey, fontFamily: F.body, fontSize: 13 },
  infoVal: { color: C.white, fontFamily: F.bold, fontSize: 16, marginTop: 2 },
  anon: { color: C.grey, fontFamily: F.body, fontSize: 13, textAlign: 'center' },
});
