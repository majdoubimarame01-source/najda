import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinPad } from '../components/PinPad';
import { Btn } from '../components/ui';
import { logout } from '../lib/auth';
import { savePin } from '../lib/pin';
import { useApp, type Sensitivity } from '../lib/store';
import { C, F, R } from '../lib/theme';

const SENS: { v: Sensitivity; label: string; sub: string }[] = [
  { v: 'low', label: 'Low', sub: 'Only very violent grabs' },
  { v: 'normal', label: 'Normal', sub: 'Recommended' },
  { v: 'high', label: 'High', sub: 'Strong shakes' },
];

/** Settings: security code (the "réglage code" screen), shake sensitivity, privacy, account. */
export default function Settings() {
  const me = useApp((s) => s.me);
  const pinHash = useApp((s) => s.pinHash);
  const sensitivity = useApp((s) => s.sensitivity);
  const set = useApp((s) => s.set);
  const [pinStep, setPinStep] = useState<'idle' | 'new' | 'confirm' | 'done'>('idle');
  const [first, setFirst] = useState('');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.h1}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.label}>SECURITY CODE</Text>
          {pinStep === 'idle' || pinStep === 'done' ? (
            <>
              <Text style={styles.body}>
                {pinStep === 'done'
                  ? 'New code saved.'
                  : pinHash
                    ? 'Your 4-digit code stops a shake alert. Never share it.'
                    : 'Default code is 1234 — change it now.'}
              </Text>
              <Text style={styles.sub}>
                If a robber grabs your phone, they don't know the code: the countdown ends and your circle is alerted.
              </Text>
              <Btn title={pinHash ? 'Change my code' : 'Set my code'} variant="red" onPress={() => setPinStep('new')} />
            </>
          ) : (
            <>
              <Text style={styles.body}>{pinStep === 'new' ? 'Choose a new 4-digit code' : 'Type it again to confirm'}</Text>
              <PinPad
                key={pinStep}
                onComplete={async (c) => {
                  if (pinStep === 'new') {
                    setFirst(c);
                    setPinStep('confirm');
                    return true;
                  }
                  if (c !== first) {
                    setPinStep('new');
                    return false;
                  }
                  await savePin(c);
                  setPinStep('done');
                  return true;
                }}
              />
              <Btn title="Cancel" variant="ghost" onPress={() => setPinStep('idle')} />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>SHAKE SENSITIVITY</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SENS.map((s) => (
              <Pressable
                key={s.v}
                onPress={() => set({ sensitivity: s.v })}
                style={[styles.chip, sensitivity === s.v && { borderColor: C.red, backgroundColor: C.cardHi }]}
              >
                <Text style={styles.chipTxt}>{s.label}</Text>
                <Text style={[styles.sub, { fontSize: 11 }]}>{s.sub}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sub}>Shake detection runs in Walk mode while najda is open.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.surface }]}>
          <Text style={styles.label}>PRIVACY</Text>
          <Text style={styles.sub}>
            • Location is shared only with your trusted circle, only during an active alert.{'\n'}• It's deleted when you
            resolve the alert (and anything left after 7 days is purged).{'\n'}• No location tracking the rest of the time.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>ACCOUNT</Text>
          <Text style={styles.body}>
            {me?.name} · {me?.phone}
          </Text>
          <Btn
            title="Log out"
            variant="ghost"
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { color: C.grey, fontFamily: F.medium, fontSize: 17 },
  h1: { color: C.white, fontFamily: F.title, fontSize: 30 },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16, gap: 12 },
  label: { color: C.grey, fontFamily: F.semi, fontSize: 12, letterSpacing: 1 },
  body: { color: C.white, fontFamily: F.semi, fontSize: 16 },
  sub: { color: C.grey, fontFamily: F.body, fontSize: 13, lineHeight: 19 },
  chip: { flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: 10, borderWidth: 2, borderColor: C.border },
  chipTxt: { color: C.white, fontFamily: F.bold, fontSize: 15 },
});
