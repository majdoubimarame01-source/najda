import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Icon } from '../components/ui';
import { loadMembers } from '../lib/alerts';
import { DEMO_CIRCLE, isSupabaseConfigured } from '../lib/config';
import { getApp, useApp } from '../lib/store';
import { supabase, type Profile } from '../lib/supabase';
import { C, F, R } from '../lib/theme';

function seen(m: Profile): { online: boolean; txt: string } {
  if (!m.last_seen) return { online: false, txt: 'Never seen' };
  const min = Math.round((Date.now() - new Date(m.last_seen).getTime()) / 60000);
  if (min < 2) return { online: true, txt: 'Online' };
  if (min < 60) return { online: false, txt: `Seen ${min} min ago` };
  return { online: false, txt: `Seen ${Math.round(min / 60)} h ago` };
}

/** "My circle" — trusted contacts: status, invite, join, remove. */
export default function Circle() {
  const me = useApp((s) => s.me);
  const offline = useApp((s) => s.offline);
  const members = useApp((s) => s.members);
  const [circle, setCircle] = useState<{ code: string; name: string } | null>(null);
  const [join, setJoin] = useState('');
  const [busy, setBusy] = useState(false);
  const online = isSupabaseConfigured && !offline;

  useEffect(() => {
    loadMembers();
    if (!me?.circle_id) return;
    if (!online) return setCircle(DEMO_CIRCLE);
    supabase
      .from('circles')
      .select('code,name')
      .eq('id', me.circle_id)
      .maybeSingle()
      .then(({ data }) => data && setCircle(data));
  }, [me?.circle_id]);

  const others = members.filter((m) => m.id !== me?.id);

  const onJoin = async () => {
    if (!me || !online) return;
    setBusy(true);
    const { data: c } = await supabase.from('circles').select('id,code,name').eq('code', join.trim().toUpperCase()).maybeSingle();
    if (!c) {
      setBusy(false);
      return Alert.alert('Code not found', 'Check the invite code and try again.');
    }
    await supabase.from('users').update({ circle_id: c.id }).eq('id', me.id);
    getApp().set({ me: { ...me, circle_id: c.id } });
    setCircle(c);
    setJoin('');
    await loadMembers();
    setBusy(false);
  };

  const onRemove = (m: Profile) =>
    Alert.alert(`Remove ${m.name}?`, `${m.name} will no longer receive your alerts.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (online) await supabase.from('users').update({ circle_id: null }).eq('id', m.id);
          getApp().set({ members: getApp().members.filter((x) => x.id !== m.id) });
        },
      },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.h1}>My circle</Text>
        <Text style={styles.sub}>
          {others.length} trusted contact{others.length === 1 ? '' : 's'} · {circle?.name ?? '…'}
        </Text>

        {others.map((m) => {
          const s = seen(m);
          return (
            <Pressable key={m.id} onLongPress={() => onRemove(m)} style={styles.member}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{m.name[0]}</Text>
                <View style={[styles.status, { backgroundColor: s.online ? C.green : C.grey }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.sub}>{m.phone} · {s.txt}</Text>
              </View>
              {m.battery != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name={m.battery > 20 ? 'battery-half-outline' : 'battery-dead-outline'} size={18} color={m.battery > 20 ? C.text2 : C.red} />
                  <Text style={styles.battery}>{m.battery}%</Text>
                </View>
              )}
            </Pressable>
          );
        })}
        {others.length > 0 && <Text style={styles.hint}>Long press a contact to remove them</Text>}

        <View style={styles.card}>
          <Text style={styles.label}>INVITE TO MY CIRCLE</Text>
          <Text style={styles.code}>{circle?.code ?? '······'}</Text>
          <Btn
            title="Share invite code"
            icon="share-social-outline"
            variant="blue"
            onPress={() =>
              Share.share({
                message: `Join my najda circle so we can help each other. Code: ${circle?.code}. najda — Your alert. Your safety.`,
              })
            }
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>JOIN A CIRCLE</Text>
          <TextInput
            value={join}
            onChangeText={setJoin}
            placeholder="Invite code"
            placeholderTextColor={C.grey}
            autoCapitalize="characters"
            style={styles.input}
          />
          <Btn title="Join" loading={busy} disabled={join.trim().length < 4 || !online} onPress={onJoin} />
        </View>

        <View style={[styles.card, { backgroundColor: C.surface }]}>
          <Text style={styles.label}>PRIVACY</Text>
          <Text style={styles.sub}>
            Your circle sees your position only during an active alert. It's deleted as soon as you say “Rani labes”.
            No tracking the rest of the time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { color: C.grey, fontFamily: F.medium, fontSize: 17 },
  h1: { color: C.white, fontFamily: F.title, fontSize: 30 },
  sub: { color: C.grey, fontFamily: F.body, fontSize: 14, lineHeight: 20 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: R.lg, padding: 14 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.white, fontFamily: F.title, fontSize: 20 },
  status: { position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.card },
  name: { color: C.white, fontFamily: F.bold, fontSize: 17 },
  battery: { color: C.text2, fontFamily: F.medium, fontSize: 13 },
  hint: { color: C.grey, fontFamily: F.body, fontSize: 12, textAlign: 'center' },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16, gap: 12 },
  label: { color: C.grey, fontFamily: F.semi, fontSize: 12, letterSpacing: 1 },
  code: { color: C.white, fontFamily: F.black, fontSize: 34, letterSpacing: 6, textAlign: 'center' },
  input: {
    backgroundColor: C.surface,
    borderRadius: R.md,
    color: C.white,
    fontFamily: F.semi,
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    letterSpacing: 3,
  },
});
