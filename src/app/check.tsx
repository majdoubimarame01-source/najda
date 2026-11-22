import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { CountdownRing } from '../components/CountdownRing';
import { LogoMark } from '../components/Logo';
import { PinPad } from '../components/PinPad';
import { Icon } from '../components/ui';
import { createAlert } from '../lib/alerts';
import { checkPin } from '../lib/pin';
import { getApp, useApp } from '../lib/store';
import { C, F, R } from '../lib/theme';

const MAX_TRIES = 3;

/** "Mariem, labes?" — shake check. No cancel: only the right code stops the alert. */
export default function Check() {
  const me = useApp((s) => s.me);
  const demoMode = useApp((s) => s.demoMode);
  const total = demoMode ? 5 : 15;
  const [left, setLeft] = useState(total * 1000);
  const [tries, setTries] = useState(0);
  const [state, setState] = useState<'counting' | 'safe' | 'sending'>('counting');
  const done = useRef(false);

  const send = async () => {
    if (done.current) return;
    done.current = true;
    setState('sending');
    await createAlert('shake_no_code');
    router.replace('/silent');
  };

  // Countdown (tick every 100 ms, haptic each second).
  useEffect(() => {
    const start = Date.now();
    let lastSec = total;
    const t = setInterval(() => {
      if (done.current) return clearInterval(t);
      const remaining = total * 1000 - (Date.now() - start);
      setLeft(Math.max(0, remaining));
      const sec = Math.ceil(remaining / 1000);
      if (sec < lastSec) {
        lastSec = sec;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }
      if (remaining <= 0) {
        clearInterval(t);
        send();
      }
    }, 100);
    return () => clearInterval(t);
  }, [total]);

  // No way out: hardware back is blocked.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      sub.remove();
      getApp().set({ checkOpen: false });
    };
  }, []);

  const onCode = async (code: string) => {
    if (done.current) return true;
    if (await checkPin(code)) {
      done.current = true;
      setState('safe');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => router.replace('/'), 1400);
      return true;
    }
    const n = tries + 1;
    setTries(n);
    if (n >= MAX_TRIES) send();
    return false;
  };

  if (state === 'safe') {
    return (
      <View style={[styles.full, { backgroundColor: C.greenDark, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="checkmark" size={56} color="#000" />
        </View>
        <Text style={[styles.title, { marginTop: 12 }]}>Labes, hamdoulah</Text>
        <Text style={styles.sub}>False alarm — nothing was sent.</Text>
      </View>
    );
  }

  const secs = Math.ceil(left / 1000);
  return (
    <View style={styles.full}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="38%" r="75%">
            <Stop offset="0" stopColor={C.redDark} />
            <Stop offset="1" stopColor="#0A0102" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#g)" />
      </Svg>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <View style={styles.tag}>
            <View style={styles.tagIcon}>
              <LogoMark size={16} color="#fff" />
            </View>
            <Text style={styles.tagTxt}>NAJDA · SHAKE DETECTED</Text>
          </View>

          <Text style={styles.title}>{me?.name ?? 'Hey'}, labes?</Text>
          <Text style={styles.sub}>A sudden movement was detected. Are you okay?</Text>

          <View style={{ alignItems: 'center', marginVertical: 18 }}>
            <CountdownRing progress={left / (total * 1000)} size={190}>
              <Text style={styles.secs}>{secs}</Text>
              <Text style={styles.secsLbl}>seconds</Text>
            </CountdownRing>
          </View>

          <Text style={styles.warn}>
            Without your code, an <Text style={{ color: C.red, fontFamily: F.bold }}>alert</Text> goes to your trusted
            circle with your position.
          </Text>

          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="lock-closed" size={18} />
              <Text style={styles.cardTitle}>Enter your security code</Text>
            </View>
            {tries > 0 && (
              <Text style={[styles.cardSub, { color: C.red }]}>
                Wrong code · {MAX_TRIES - tries} {MAX_TRIES - tries === 1 ? 'try' : 'tries'} left
              </Text>
            )}
            <View style={{ marginTop: 12 }}>
              <PinPad compact onComplete={onCode} disabled={state !== 'counting'} />
            </View>
            <Text style={styles.foot}>The “Cancel” button is disabled for your safety</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#0A0102' },
  content: { padding: 20, paddingBottom: 28 },
  tag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6 },
  tagIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  tagTxt: { color: C.white, fontFamily: F.bold, fontSize: 14, letterSpacing: 1.5 },
  title: { color: C.white, fontFamily: F.black, fontSize: 40, textAlign: 'center', marginTop: 18, lineHeight: 46 },
  sub: { color: '#E8B9B9', fontFamily: F.body, fontSize: 16, textAlign: 'center', marginTop: 8 },
  secs: { color: C.white, fontFamily: F.black, fontSize: 76, lineHeight: 84 },
  secsLbl: { color: '#E8B9B9', fontFamily: F.semi, fontSize: 15 },
  warn: { color: C.text2, fontFamily: F.semi, fontSize: 15, textAlign: 'center', marginBottom: 16 },
  card: { backgroundColor: 'rgba(28,22,24,0.9)', borderRadius: R.xl, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTitle: { color: C.white, fontFamily: F.bold, fontSize: 18, textAlign: 'center' },
  cardSub: { color: C.grey, fontFamily: F.body, fontSize: 13, textAlign: 'center', marginTop: 4 },
  foot: { color: C.grey, fontFamily: F.body, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
