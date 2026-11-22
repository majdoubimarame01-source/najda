import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '../components/ui';
import { resetMyAlerts, triggerLocalDemoAlert } from '../lib/alerts';
import { EAS_PROJECT_ID, isSupabaseConfigured } from '../lib/config';
import { getApp, useApp } from '../lib/store';
import { C, F, R } from '../lib/theme';

/** Hidden demo panel (tap the najda logo 5×). Guarantees the stage demo works. */
export default function Demo() {
  const s = useApp();
  const [msg, setMsg] = useState('');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.h1}>Demo mode</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Demo mode</Text>
            <Text style={styles.sub}>Fake GPS on Bd du 14 Janvier · 5 s countdown · simulated run</Text>
          </View>
          <Switch value={s.demoMode} onValueChange={(v) => s.set({ demoMode: v })} trackColor={{ true: C.blue, false: C.border }} thumbColor="#fff" />
        </View>

        <Text style={styles.label}>THIS PHONE IS</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['victim', 'helper'] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => s.set({ demoRole: r })}
              style={[styles.chip, s.demoRole === r && { borderColor: r === 'victim' ? C.red : C.green, backgroundColor: C.cardHi }]}
            >
              <Text style={styles.chipTitle}>{r === 'victim' ? 'Victim' : 'Helper'}</Text>
              <Text style={styles.sub}>{r === 'victim' ? 'Bd du 14 Janvier' : '350 m away'}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>VICTIM PHONE</Text>
        <Btn
          title="Simulate shake"
          icon="phone-portrait-outline"
          variant="red"
          onPress={() => {
            getApp().set({ checkOpen: true });
            router.replace('/check');
          }}
        />

        <Text style={styles.label}>HELPER PHONE — OFFLINE FALLBACK</Text>
        <Btn
          title="Trigger demo alert locally"
          icon="notifications-outline"
          onPress={async () => {
            await triggerLocalDemoAlert();
            setMsg('Local alert fired — tap the notification.');
          }}
        />

        <Text style={styles.label}>RESET</Text>
        <Btn
          title="Reset my alerts"
          variant="ghost"
          onPress={async () => {
            await resetMyAlerts();
            setMsg('All my alerts resolved.');
          }}
        />
        {!!msg && <Text style={[styles.sub, { color: C.green }]}>{msg}</Text>}

        <View style={styles.status}>
          <Text style={styles.sub}>Supabase: {isSupabaseConfigured ? (s.offline ? 'configured · OFFLINE profile' : 'connected') : 'not configured (offline demo)'}</Text>
          <Text style={styles.sub}>Expo push: {EAS_PROJECT_ID ? 'project id set' : 'no EAS project id (Realtime only)'}</Text>
          <Text style={styles.sub}>Logged in as: {s.me?.name} ({s.me?.phone})</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { color: C.grey, fontFamily: F.medium, fontSize: 17 },
  h1: { color: C.white, fontFamily: F.title, fontSize: 30 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.lg, padding: 16, gap: 12 },
  title: { color: C.white, fontFamily: F.bold, fontSize: 17 },
  sub: { color: C.grey, fontFamily: F.body, fontSize: 13, marginTop: 2 },
  label: { color: C.grey, fontFamily: F.semi, fontSize: 12, letterSpacing: 1, marginTop: 6 },
  chip: { flex: 1, backgroundColor: C.card, borderRadius: R.lg, padding: 14, borderWidth: 2, borderColor: C.border },
  chipTitle: { color: C.white, fontFamily: F.bold, fontSize: 16 },
  status: { backgroundColor: C.surface, borderRadius: R.md, padding: 12, marginTop: 8 },
});
