import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nameOf } from '../lib/alerts';
import { getApp } from '../lib/store';
import type { AlertRow } from '../lib/supabase';
import { C, F } from '../lib/theme';
import { Btn, Icon } from './ui';

/** Victim side: the alert was closed (a helper arrived, or resolved elsewhere). */
export function AlertClosed({ alert }: { alert: AlertRow }) {
  const withYou = (alert.arrived_ids ?? []).map(nameOf);
  return (
    <SafeAreaView style={styles.full}>
      <View style={styles.icon}>
        <Icon name={withYou.length ? 'people' : 'checkmark'} size={52} color="#000" />
      </View>
      <Text style={styles.title}>
        {withYou.length ? `${withYou.join(' and ')} ${withYou.length > 1 ? 'are' : 'is'} with you` : 'Alert closed'}
      </Text>
      <Text style={styles.sub}>The alert is closed and your location was deleted.</Text>
      <Btn
        title="Back home"
        variant="green"
        style={{ alignSelf: 'stretch', marginTop: 32 }}
        onPress={() => {
          getApp().set({ myActiveAlertId: null });
          router.replace('/');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: C.greenDark, padding: 24, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.white, fontFamily: F.title, fontSize: 26, textAlign: 'center', marginTop: 18 },
  sub: { color: C.text2, fontFamily: F.body, fontSize: 15, textAlign: 'center', marginTop: 8 },
});
