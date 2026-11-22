import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

// When keys are missing the app still runs fully offline in demo mode.
export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? SUPABASE_ANON_KEY : 'placeholder-anon-key-placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 10 } },
  },
);

export type Profile = {
  id: string;
  name: string;
  phone: string;
  circle_id: string | null;
  push_token?: string | null;
  battery?: number | null;
  last_seen?: string | null;
};

export type AlertType =
  | 'braquage'
  | 'harcelement'
  | 'agression'
  | 'accident'
  | 'medical'
  | 'autre'
  | 'shake_no_code'
  | 'manual';

export type AlertStatus = 'active' | 'responding' | 'resolved';

export type AlertRow = {
  id: string;
  user_id: string;
  circle_id: string | null;
  type: AlertType;
  status: AlertStatus;
  lat: number | null;
  lng: number | null;
  address: string | null;
  created_at: string;
  resolved_at: string | null;
  responder_ids: string[];
  arrived_ids?: string[];
};
