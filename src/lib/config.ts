import Constants from 'expo-constants';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const ORS_KEY = process.env.EXPO_PUBLIC_ORS_KEY ?? '';

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR-PROJECT') && SUPABASE_ANON_KEY.length > 20;

export const EAS_PROJECT_ID: string | undefined =
  (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;

// Demo geography: Bd du 14 Janvier, Sousse (victim) and a helper ~350 m away.
export const DEMO_VICTIM = { lat: 35.8452, lng: 10.6152 };
export const DEMO_HELPER = { lat: 35.843, lng: 10.6125 };
export const DEMO_ADDRESS = 'Bd du 14 Janvier, Sousse';

// Seeded demo accounts (must match supabase/schema.sql and the Supabase Auth test phone numbers).
export const DEMO_OTP = '123456';
export const DEMO_PROFILES = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Mariem', phone: '+21620000001' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Maram', phone: '+21620000002' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Yassine', phone: '+21620000003' },
] as const;
export const DEMO_CIRCLE = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', code: 'SOUSSE', name: 'Family' };

export const RUN_SPEED_MS = 10_000 / 3600; // ~10 km/h running
export const SIMULATED_NEARBY_USERS = 12;
