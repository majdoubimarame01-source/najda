import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { DEMO_HELPER, DEMO_VICTIM } from './config';
import type { LatLng } from './geo';
import { withTimeout } from './geo';
import { getApp, useApp } from './store';

export type Fix = LatLng & { accuracy: number | null };

function demoFix(): Fix {
  const { demoRole } = getApp();
  return { ...(demoRole === 'victim' ? DEMO_VICTIM : DEMO_HELPER), accuracy: 5 };
}

export async function ensureLocationPermission(): Promise<boolean> {
  try {
    const cur = await Location.getForegroundPermissionsAsync();
    if (cur.status === 'granted') return true;
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Best-effort current position. Never throws; demo mode returns the scripted Sousse position. */
export async function getMyPosition(): Promise<Fix> {
  if (getApp().demoMode) return demoFix();
  try {
    if (!(await ensureLocationPermission())) return demoFix();
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    try {
      const fresh = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        last ? 3000 : 8000,
      );
      return { lat: fresh.coords.latitude, lng: fresh.coords.longitude, accuracy: fresh.coords.accuracy };
    } catch {
      if (last) return { lat: last.coords.latitude, lng: last.coords.longitude, accuracy: last.coords.accuracy };
    }
  } catch {
    // ignore
  }
  return demoFix();
}

/** Live position of this phone (foreground only). In demo mode: fixed scripted position. */
export function useMyPosition(): Fix | null {
  const demoMode = useApp((s) => s.demoMode);
  const demoRole = useApp((s) => s.demoRole);
  const [pos, setPos] = useState<Fix | null>(null);

  useEffect(() => {
    if (demoMode) {
      setPos(demoFix());
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      setPos(await getMyPosition());
      if (cancelled || !(await ensureLocationPermission())) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
        (l) => setPos({ lat: l.coords.latitude, lng: l.coords.longitude, accuracy: l.coords.accuracy }),
      );
      if (cancelled) sub.remove();
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [demoMode, demoRole]);

  return pos;
}
