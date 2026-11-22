import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveAlert } from '../lib/alerts';
import { checkPin } from '../lib/pin';
import { C, F, R } from '../lib/theme';
import { PinPad } from './PinPad';

/** "Rani labes — I'm safe": PIN-protected resolve (a robber can't close the alert). */
export function SafeResolver({ alertId, dim }: { alertId: string | null; dim?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.btn,
          dim ? { backgroundColor: '#0B0C0D', borderColor: '#1A1C1F' } : { backgroundColor: C.green },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={[styles.btnTxt, dim ? { color: '#3A3F45' } : { color: '#000' }]}>Rani labes — I'm safe</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Confirm with your code</Text>
          <Text style={styles.sub}>Your circle will be told you're safe and your location is deleted.</Text>
          <PinPad
            onComplete={async (code) => {
              if (!(await checkPin(code))) return false;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setOpen(false);
              router.replace('/');
              if (alertId) await resolveAlert(alertId);
              return true;
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 58, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  btnTxt: { fontFamily: F.bold, fontSize: 17 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: C.surface, padding: 20, paddingBottom: 36, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 14 },
  title: { color: C.white, fontFamily: F.title, fontSize: 22, textAlign: 'center' },
  sub: { color: C.grey, fontFamily: F.body, fontSize: 14, textAlign: 'center' },
});
