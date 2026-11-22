// Two-user backend test of the najda story, against the real Supabase project.
// Mariem and Maram are two separate clients (like two phones).
// Run:  node scripts/simulate-demo.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const MARIEM = '11111111-1111-1111-1111-111111111111';
const MARAM = '22222222-2222-2222-2222-222222222222';
const CIRCLE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mariem = createClient(URL_, KEY, { auth: { persistSession: false } });
const maram = createClient(URL_, KEY, { auth: { persistSession: false } });

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitFor(events, pred, ms = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const t = setInterval(() => {
      const hit = events.find(pred);
      if (hit || Date.now() - start > ms) {
        clearInterval(t);
        resolve(hit ? { ...hit, ms: hit.at - start } : null);
      }
    }, 50);
  });
}

// --- Both phones subscribe to their circle's alerts (exactly like Watchers.tsx) ---
const maramEvents = [];
const mariemEvents = [];
const sub = (client, events, name) =>
  new Promise((resolve) => {
    client
      .channel(`circle-${CIRCLE}-${name}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', filter: `circle_id=eq.${CIRCLE}` }, (p) =>
        events.push({ type: 'INSERT', row: p.new, at: Date.now() }),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts', filter: `circle_id=eq.${CIRCLE}` }, (p) =>
        events.push({ type: 'UPDATE', row: p.new, at: Date.now() }),
      )
      .subscribe((s) => s === 'SUBSCRIBED' && resolve());
  });

console.log('\n— najda two-phone backend simulation —\n');
await Promise.all([sub(maram, maramEvents, 'maram'), sub(mariem, mariemEvents, 'mariem')]);
ok(true, 'Both phones connected to Realtime');

// Clean slate.
await mariem.from('alerts').update({ status: 'resolved', lat: null, lng: null }).eq('user_id', MARIEM).neq('status', 'resolved');

// 1. Mariem's phone: shake, no code -> alert.
let t0 = Date.now();
const { data: alert, error } = await mariem
  .from('alerts')
  .insert({ user_id: MARIEM, circle_id: CIRCLE, type: 'shake_no_code', status: 'active', lat: 35.8452, lng: 10.6152, address: 'Bd du 14 Janvier, Sousse' })
  .select()
  .single();
ok(!error && alert, `Mariem sends a silent alert (${Date.now() - t0} ms)${error ? ' — ' + error.message : ''}`);

// 2. Maram's phone receives it live.
const got = await waitFor(maramEvents, (e) => e.type === 'INSERT' && e.row.id === alert?.id);
ok(!!got, `Maram receives the alert in real time${got ? ` (${got.row.type}, ${got.ms} ms)` : ''}`);
ok(got?.row.lat === 35.8452, "Maram gets Mariem's position");

// 3. Maram: "I'm going".
const { data: r1 } = await maram.rpc('respond_alert', { p_alert: alert.id, p_user: MARAM });
ok(r1?.status === 'responding' && r1?.responder_ids?.includes(MARAM), "Maram taps \"I'm going\" -> status responding");
const seen1 = await waitFor(mariemEvents, (e) => e.type === 'UPDATE' && e.row.responder_ids?.includes(MARAM));
ok(!!seen1, `Mariem's phone sees "Maram is on the way"${seen1 ? ` (${seen1.ms} ms)` : ''}`);

// 4. Maram: "I'm with Mariem".
const { data: r2 } = await maram.rpc('arrive_alert', { p_alert: alert.id, p_user: MARAM });
ok(r2?.arrived_ids?.includes(MARAM), 'Maram taps "I\'m with Mariem" -> arrived');
const seen2 = await waitFor(mariemEvents, (e) => e.type === 'UPDATE' && e.row.arrived_ids?.includes(MARAM));
ok(!!seen2, `Mariem's phone sees "Maram is with you"${seen2 ? ` (${seen2.ms} ms)` : ''}`);

// 5. Mariem: "Rani labes" + PIN -> resolve, location wiped.
const { data: r3 } = await mariem.rpc('resolve_alert', { p_alert: alert.id });
ok(r3?.status === 'resolved' && r3?.lat === null && r3?.address === null, 'Mariem resolves -> location deleted');
const seen3 = await waitFor(maramEvents, (e) => e.type === 'UPDATE' && e.row.id === alert.id && e.row.status === 'resolved');
ok(!!seen3, `Maram's phone sees "Mariem is safe"${seen3 ? ` (${seen3.ms} ms)` : ''}`);

// 6. A resolved alert can't be re-opened by a late "I'm going".
const { data: r4 } = await maram.rpc('respond_alert', { p_alert: alert.id, p_user: MARAM });
ok(!r4 || r4.status === 'resolved' || r4.id == null, 'Late "I\'m going" on a closed alert is ignored');

// 7. Removed civic types are rejected.
const { error: bad } = await mariem.from('alerts').insert({ user_id: MARIEM, circle_id: CIRCLE, type: 'dechets', status: 'resolved' });
ok(!!bad, 'Old type "Garbage" is rejected by the database');

await mariem.from('alerts').delete().eq('id', alert.id);
console.log(`\n${failures ? `${failures} check(s) FAILED` : 'All checks passed'}\n`);
await mariem.removeAllChannels();
await maram.removeAllChannels();
process.exit(failures ? 1 : 0);
