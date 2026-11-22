import { DEMO_CIRCLE, DEMO_OTP, DEMO_PROFILES, isSupabaseConfigured } from './config';
import { withTimeout } from './geo';
import { getApp } from './store';
import { supabase, type Profile } from './supabase';

export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('216') && digits.length === 11) return `+${digits}`;
  return `+216${digits}`;
}

const SELECT = 'id,name,phone,circle_id,push_token,battery,last_seen,security_code_hash';

export async function sendOtp(phone: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured (.env). Use a demo profile.');
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

export async function verifyOtp(phone: string, code: string, name: string): Promise<Profile> {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
  if (error) throw error;
  return linkProfile(phone, data.user?.id ?? null, name);
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function linkProfile(phone: string, authId: string | null, name: string): Promise<Profile> {
  const { data: existing } = await supabase.from('users').select(SELECT).eq('phone', phone).maybeSingle();
  let row: any = existing;
  if (row) {
    if (authId) await supabase.from('users').update({ auth_id: authId }).eq('id', row.id);
  } else {
    const { data: circle } = await supabase
      .from('circles')
      .insert({ code: randomCode(), name: `${name || 'My'} circle` })
      .select()
      .single();
    const { data: created, error } = await supabase
      .from('users')
      .insert({ name: name || 'Me', phone, auth_id: authId, circle_id: circle?.id ?? null })
      .select(SELECT)
      .single();
    if (error) throw error;
    row = created;
  }
  const { security_code_hash, ...profile } = row;
  getApp().set({ me: profile as Profile, offline: false, pinHash: security_code_hash ?? getApp().pinHash });
  return profile as Profile;
}

/**
 * One-tap demo login: real OTP with the Supabase test number + fixed code; if phone auth is not
 * enabled, read the seeded row directly; if there is no network/Supabase, run fully offline.
 */
export async function demoLogin(index: number): Promise<{ mode: 'otp' | 'direct' | 'offline' }> {
  const p = DEMO_PROFILES[index];
  if (isSupabaseConfigured) {
    try {
      await withTimeout(sendOtp(p.phone), 6000);
      await withTimeout(verifyOtp(p.phone, DEMO_OTP, p.name), 6000);
      return { mode: 'otp' };
    } catch (e) {
      console.log('[auth] OTP demo login failed, falling back:', String(e));
    }
    try {
      const { data } = await withTimeout(
        Promise.resolve(supabase.from('users').select(SELECT).eq('id', p.id).maybeSingle()),
        6000,
      );
      if (data) {
        const { security_code_hash, ...profile } = data as any;
        getApp().set({ me: profile as Profile, offline: false, pinHash: security_code_hash ?? null });
        return { mode: 'direct' };
      }
    } catch {
      // fall through to offline
    }
  }
  getApp().set({
    me: { id: p.id, name: p.name, phone: p.phone, circle_id: DEMO_CIRCLE.id },
    offline: true,
    members: DEMO_PROFILES.map((x) => ({ ...x, circle_id: DEMO_CIRCLE.id, battery: 80, last_seen: new Date().toISOString() })),
  });
  return { mode: 'offline' };
}

export async function logout() {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  getApp().logout();
}
