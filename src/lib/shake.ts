import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';

/**
 * Violent shake / grab detector.
 * A "spike" = acceleration magnitude above `thresholdG` (in g; 1 g = resting phone).
 * Trigger = `spikes` spikes within `windowMs`, then a cooldown so one grab fires once.
 */
export function useShakeDetector(
  enabled: boolean,
  thresholdG: number,
  onShake: () => void,
  { spikes = 3, windowMs = 1500, cooldownMs = 10_000 } = {},
) {
  const cb = useRef(onShake);
  cb.current = onShake;

  useEffect(() => {
    if (!enabled) return;
    let hits: number[] = [];
    let lastSpike = 0;
    let cooldownUntil = 0;
    Accelerometer.setUpdateInterval(50);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();
      if (now < cooldownUntil) return;
      const g = Math.sqrt(x * x + y * y + z * z);
      if (g < thresholdG || now - lastSpike < 120) return; // debounce one physical jolt
      lastSpike = now;
      hits = [...hits.filter((t) => now - t < windowMs), now];
      if (hits.length >= spikes) {
        hits = [];
        cooldownUntil = now + cooldownMs;
        cb.current();
      }
    });
    return () => sub.remove();
  }, [enabled, thresholdG, spikes, windowMs, cooldownMs]);
}
