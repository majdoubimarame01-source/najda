import * as Crypto from 'expo-crypto';
import { getApp } from './store';
import { isSupabaseConfigured } from './config';
import { supabase } from './supabase';

export const DEFAULT_PIN = '1234';

export function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export async function checkPin(pin: string): Promise<boolean> {
  const stored = getApp().pinHash ?? (await hashPin(DEFAULT_PIN));
  return (await hashPin(pin)) === stored;
}

export async function savePin(pin: string): Promise<void> {
  const h = await hashPin(pin);
  getApp().set({ pinHash: h });
  const me = getApp().me;
  if (me && isSupabaseConfigured) {
    await supabase.from('users').update({ security_code_hash: h }).eq('id', me.id);
  }
}
