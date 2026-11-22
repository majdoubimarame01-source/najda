import { useEffect } from 'react';
import { fetchAlert } from './alerts';
import { useApp } from './store';
import type { AlertRow } from './supabase';

/** Alert from the store, kept fresh by Realtime (CircleListener) + a 5 s polling safety net. */
export function useAlert(id: string | null | undefined): AlertRow | null {
  const alert = useApp((s) => (id ? s.alerts[id] ?? null : null));
  useEffect(() => {
    if (!id) return;
    fetchAlert(id);
    const t = setInterval(() => fetchAlert(id), 5000);
    return () => clearInterval(t);
  }, [id]);
  return alert;
}
