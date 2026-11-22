import { Redirect, router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertClosed } from '../components/AlertClosed';
import { SafeResolver } from '../components/SafeResolver';
import { Btn, Icon } from '../components/ui';
import { ALERT_LABEL, isLocalId, nameOf } from '../lib/alerts';
import { SIMULATED_NEARBY_USERS } from '../lib/config';
import { useApp } from '../lib/store';
import { useAlert } from '../lib/useAlert';
import { C, F, R } from '../lib/theme';

function Row({ ok, title, sub }: { ok: boolean; title: string; sub: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, ok ? { backgroundColor: C.green } : { backgroundColor: C.cardHi }]}>
        <Icon name={ok ? 'checkmark' : 'ellipsis-horizontal'} size={18} color={ok ? '#000' : C.text2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
    </View>
  );
}

/** "Alert sent" confirmation (manual SIGNAL flow). */
export default function Sent() {
  const id = useApp((s) => s.myActiveAlertId);
  const me = useApp((s) => s.me);
  const members = useApp((s) => s.members);
  const alert = useAlert(id);
  if (!id) return <Redirect href="/" />;
  if (alert?.status === 'resolved') return <AlertClosed alert={alert} />;

  const contacts = members.filter((m) => m.id !== me?.id).length;
  const sending = isLocalId(id);
  const arrived = alert?.arrived_ids ?? [];
  const responders = (alert?.responder_ids ?? []).filter((r) => !arrived.includes(r)).map(nameOf);
  const withYou = arrived.map(nameOf);
  const helpSub = [
    withYou.length ? `${withYou.join(' and ')} ${withYou.length > 1 ? 'are' : 'is'} with you` : '',
    responders.length ? `${responders.join(' and ')} ${responders.length > 1 ? 'are' : 'is'} on the way` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const time = alert ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}>
      <View style={{ alignItems: 'center', marginTop: 30 }}>
        <View style={[styles.ring, { width: 230, height: 230 }]}>
          <View style={[styles.ring, { width: 180, height: 180, backgroundColor: '#0E2A17' }]}>
            <View style={[styles.ring, { width: 136, height: 136, backgroundColor: C.green }]}>
              <Icon name="checkmark" size={70} color="#000" />
            </View>
          </View>
        </View>
        <Text style={styles.title}>{sending ? 'Sending alert…' : 'Alert sent'}</Text>
        <Text style={styles.sub}>Stay somewhere safe.{'\n'}We take care of the rest.</Text>
      </View>

      <View style={styles.card}>
        <Row ok={!sending} title={`Trusted circle — ${contacts} contact${contacts === 1 ? '' : 's'}`} sub={sending ? 'Sending…' : `Received · ${time}`} />
        <Row ok={!sending} title={`${SIMULATED_NEARBY_USERS} najda users nearby`} sub={alert ? ALERT_LABEL[alert.type] : 'Notified'} />
        <Row
          ok={responders.length + withYou.length > 0}
          title="Help"
          sub={helpSub || 'Waiting for a helper…'}
        />
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn title="Call 197" icon="call-outline" style={{ flex: 1 }} onPress={() => Linking.openURL('tel:197')} />
          <Btn title="Home" style={{ flex: 1 }} onPress={() => router.replace('/')} />
        </View>
        <SafeResolver alertId={id} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ring: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07170C' },
  title: { color: C.white, fontFamily: F.title, fontSize: 34, marginTop: 22 },
  sub: { color: C.grey, fontFamily: F.body, fontSize: 17, textAlign: 'center', marginTop: 6 },
  card: { backgroundColor: C.card, borderRadius: R.xl, padding: 18, gap: 18, marginTop: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: C.white, fontFamily: F.bold, fontSize: 17 },
  rowSub: { color: C.grey, fontFamily: F.body, fontSize: 14, marginTop: 2 },
});
