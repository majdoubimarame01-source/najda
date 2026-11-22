import { ORS_KEY, RUN_SPEED_MS } from './config';

export type LatLng = { lat: number; lng: number };

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 20) return 'Here';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function runEtaMinutes(m: number): number {
  return Math.max(1, Math.round(m / RUN_SPEED_MS / 60));
}

export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export type Route = { points: LatLng[]; distance: number; fromORS: boolean };

const routeCache = new Map<string, Route>();

/** Remaining part of a route from the helper's current position (drops points already passed). */
export function remainingRoute(points: LatLng[], pos: LatLng): LatLng[] {
  if (points.length < 2) return [pos, ...points];
  let best = 0;
  let bestD = Infinity;
  points.forEach((p, i) => {
    const d = haversine(p, pos);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const end = points[points.length - 1];
  // If the closest vertex is behind us, skip it.
  const next = best < points.length - 1 && haversine(pos, end) < haversine(points[best], end) ? best + 1 : best;
  return [pos, ...points.slice(Math.max(1, next))];
}

/** Walking route via OpenRouteService (free key). Fallback: straight line. */
export async function fetchRoute(from: LatLng, to: LatLng): Promise<Route> {
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;

  if (ORS_KEY) {
    try {
      const url =
        `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${ORS_KEY}` +
        `&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}`;
      const res = await withTimeout(fetch(url), 4000);
      if (res.ok) {
        const json = await res.json();
        const f = json.features?.[0];
        const coords: [number, number][] = f?.geometry?.coordinates ?? [];
        if (coords.length > 1) {
          const route = {
            points: coords.map(([lng, lat]) => ({ lat, lng })),
            distance: f.properties?.summary?.distance ?? haversine(from, to),
            fromORS: true,
          };
          routeCache.set(key, route);
          return route;
        }
      }
    } catch {
      // fall through to straight-line fallback
    }
  }
  // Fallback: straight line (distance matches the notification's "x m from you").
  const route = { points: [from, to], distance: haversine(from, to), fromORS: false };
  routeCache.set(key, route);
  return route;
}

const geoCache = new Map<string, string>();
let lastNominatim = 0;

/** Reverse geocoding via Nominatim (OSM). Max 1 req/s, User-Agent set, results cached. */
export async function reverseGeocode(p: LatLng): Promise<string | null> {
  const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  if (geoCache.has(key)) return geoCache.get(key)!;
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  try {
    const res = await withTimeout(
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${p.lat}&lon=${p.lng}`,
        { headers: { 'User-Agent': 'najda-hackathon-demo/1.0', 'Accept-Language': 'fr,en' } },
      ),
      4000,
    );
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address ?? {};
    const street = a.road ?? a.pedestrian ?? a.neighbourhood ?? a.suburb;
    const city = a.city ?? a.town ?? a.village ?? 'Sousse';
    const label = street ? `${street}, ${city}` : j.display_name?.split(',').slice(0, 2).join(',') ?? null;
    if (label) geoCache.set(key, label);
    return label;
  } catch {
    return null;
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
