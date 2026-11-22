import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeResolver } from '../components/SafeResolver';
import { isLocalId, nameOf } from '../lib/alerts';
import { useApp } from '../lib/store';
import { useAlert } from '../lib/useAlert';
import { F } from '../lib/theme';

/**
 * Victim screen after a shake alert: almost black so a robber sees "nothing".
 * Tiny grey text only the owner knows to look for.
 */
export default function Silent() {
  const id = useApp((s) => s.myActiveAlertId);
  const alert = useAlert(id);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (!id) return <Redirect href="/" />;

  const arrived = alert?.arrived_ids ?? [];
  const responders = (alert?.responder_ids ?? []).filter((r) => !arrived.includes(r)).map(nameOf);
  const withYou = arrived.map(nameOf);
  return (
    <View style={styles.full}>
      <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ marginTop: 40, gap: 6 }}>
          <Text style={styles.t1}>● Silent alert sent</Text>
          <Text style={styles.t2}>
            {isLocalId(id) ? 'Sending… retrying in the background' : 'Your circle has your last position.'}
          </Text>
          {withYou.length > 0 && (
            <Text style={[styles.t2, { color: '#2E8A4D' }]}>
              {withYou.join(' and ')} {withYou.length > 1 ? 'are' : 'is'} with you
            </Text>
          )}
          {responders.length > 0 && (
            <Text style={[styles.t2, { color: '#1F5C33' }]}>
              {responders.join(' and ')} {responders.length > 1 ? 'are' : 'is'} on the way
            </Text>
          )}
        </View>
        <View style={{ gap: 10 }}>
          <Pressable onPress={() => Linking.openURL('tel:197')} style={styles.call}>
            <Text style={styles.callTxt}>Call 197</Text>
          </Pressable>
          <SafeResolver alertId={id} dim />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#000' },
  t1: { color: '#3A3F45', fontFamily: F.semi, fontSize: 14 },
  t2: { color: '#2A2E33', fontFamily: F.body, fontSize: 13 },
  call: { minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0C0D' },
  callTxt: { color: '#3A3F45', fontFamily: F.semi, fontSize: 15 },
});
