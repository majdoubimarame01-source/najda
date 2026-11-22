import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wordmark } from '../components/Logo';
import { Btn } from '../components/ui';
import { demoLogin, normalizePhone, sendOtp, verifyOtp } from '../lib/auth';
import { DEMO_PROFILES, isSupabaseConfigured } from '../lib/config';
import { getApp } from '../lib/store';
import { C, F, R } from '../lib/theme';

export default function Login() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const full = normalizePhone(phone);

  const onSend = async () => {
    setErr('');
    setBusy('send');
    try {
      await sendOtp(full);
      setStep('code');
    } catch (e: any) {
      setErr(e?.message ?? 'Could not send the code');
    }
    setBusy(null);
  };

  const onVerify = async () => {
    setErr('');
    setBusy('verify');
    try {
      await verifyOtp(full, code, name.trim());
      router.replace('/');
    } catch (e: any) {
      setErr(e?.message ?? 'Wrong code');
    }
    setBusy(null);
  };

  const onDemo = async (i: number) => {
    setErr('');
    setBusy(`demo${i}`);
    const { mode } = await demoLogin(i);
    getApp().set({ demoRole: i === 0 ? 'victim' : 'helper' });
    setBusy(null);
    if (mode === 'offline' && isSupabaseConfigured) setErr('No connection — running in offline demo mode.');
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginTop: 36, marginBottom: 20 }}>
            <Wordmark size={44} />
            <Text style={styles.tagline}>Your alert. Your safety.</Text>
          </View>

          {step === 'phone' ? (
            <>
              <Text style={styles.label}>PHONE NUMBER</Text>
              <View style={styles.phoneRow}>
                <Text style={styles.prefix}>+216</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="20 000 001"
                  placeholderTextColor={C.grey}
                  keyboardType="phone-pad"
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                />
              </View>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your first name (new users)"
                placeholderTextColor={C.grey}
                style={styles.input}
              />
              <Btn title="Send SMS code" variant="red" loading={busy === 'send'} disabled={phone.length < 8} onPress={onSend} />
            </>
          ) : (
            <>
              <Text style={styles.label}>CODE SENT TO {full}</Text>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                placeholderTextColor={C.grey}
                keyboardType="number-pad"
                style={[styles.input, { fontSize: 28, letterSpacing: 10, textAlign: 'center' }]}
                autoFocus
              />
              <Btn title="Verify" variant="red" loading={busy === 'verify'} disabled={code.length !== 6} onPress={onVerify} />
              <Pressable onPress={() => setStep('phone')}>
                <Text style={styles.link}>‹ Change number</Text>
              </Pressable>
            </>
          )}

          {!!err && <Text style={styles.err}>{err}</Text>}

          <View style={styles.sep}>
            <View style={styles.line} />
            <Text style={styles.sepTxt}>DEMO PROFILES</Text>
            <View style={styles.line} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {DEMO_PROFILES.map((p, i) => (
              <Btn
                key={p.id}
                title={p.name}
                style={{ flex: 1 }}
                variant={i === 0 ? 'red' : 'dark'}
                loading={busy === `demo${i}`}
                onPress={() => onDemo(i)}
              />
            ))}
          </View>
          <Text style={styles.small}>
            Demo profiles use Supabase test numbers (code 123456). Mariem = victim phone, Maram = helper phone.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tagline: { color: C.text2, fontFamily: F.medium, fontSize: 17, marginTop: 12 },
  label: { color: C.grey, fontFamily: F.semi, fontSize: 12, letterSpacing: 1 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border },
  prefix: { color: C.white, fontFamily: F.semi, fontSize: 17, paddingLeft: 16 },
  input: {
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    color: C.white,
    fontFamily: F.medium,
    fontSize: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  link: { color: C.grey, fontFamily: F.medium, fontSize: 15, textAlign: 'center' },
  err: { color: C.red, fontFamily: F.medium, fontSize: 14, textAlign: 'center' },
  sep: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  line: { flex: 1, height: 1, backgroundColor: C.border },
  sepTxt: { color: C.grey, fontFamily: F.semi, fontSize: 12, letterSpacing: 1 },
  small: { color: C.grey, fontFamily: F.body, fontSize: 12, textAlign: 'center' },
});
