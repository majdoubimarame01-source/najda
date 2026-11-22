import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, R } from '../lib/theme';

type Props = {
  length?: number;
  /** Return true to accept, false to clear + error buzz. */
  onComplete: (code: string) => Promise<boolean> | boolean;
  compact?: boolean;
  disabled?: boolean;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export function PinPad({ length = 4, onComplete, compact, disabled }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const keyH = compact ? 50 : 62;

  const press = async (k: string) => {
    if (disabled || !k) return;
    Haptics.selectionAsync().catch(() => {});
    if (k === '⌫') return setCode((c) => c.slice(0, -1));
    const next = (code + k).slice(0, length);
    setCode(next);
    setError(false);
    if (next.length === length) {
      const ok = await onComplete(next);
      if (!ok) {
        setError(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setTimeout(() => setCode(''), 250);
      }
    }
  };

  return (
    <View style={{ gap: compact ? 10 : 16 }}>
      <View style={styles.slots}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.slot,
              compact && { width: 48, height: 52 },
              i < code.length && styles.slotFilled,
              error && { borderColor: C.red },
            ]}
          >
            {i < code.length && <View style={styles.dot} />}
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((k, i) => (
          <Pressable
            key={i}
            onPress={() => press(k)}
            disabled={!k}
            style={({ pressed }) => [
              styles.key,
              { height: keyH },
              !k && { backgroundColor: 'transparent' },
              pressed && k ? { backgroundColor: C.border } : null,
            ]}
          >
            <Text style={[styles.keyTxt, k === '⌫' && { fontSize: 20 }]}>{k}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slots: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  slot: {
    width: 56,
    height: 60,
    borderRadius: R.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.grey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: { borderStyle: 'solid', borderColor: C.white },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  key: {
    width: '31.5%',
    borderRadius: R.md,
    backgroundColor: C.cardHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyTxt: { color: C.white, fontFamily: F.semi, fontSize: 24 },
});
