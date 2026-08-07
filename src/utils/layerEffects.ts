import type { LayerEffect, TextLayer } from '../types/crt';

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic 0–1 value from a string seed (exports must match preview). */
export function hash01(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777645);
  }
  return (hash >>> 0) / 0xffffffff;
}

function effectClock(effect: LayerEffect, time: number): number {
  return (time * effect.speed + effect.phase) % 1;
}

function applyOneEffect(layer: TextLayer, effect: LayerEffect, time: number): TextLayer {
  if (!effect.enabled || effect.intensity <= 0) return layer;

  const intensity = clamp01(effect.intensity);
  const clock = effectClock(effect, time);
  const angle = clock * Math.PI * 2;

  switch (effect.kind) {
    case 'jitter': {
      // Quantize time so the noise holds for a few frames, then hops.
      const step = Math.floor(time * 24 * effect.speed);
      const nx = hash01(`${layer.id}:${effect.id}:x:${step}`) * 2 - 1;
      const ny = hash01(`${layer.id}:${effect.id}:y:${step}`) * 2 - 1;
      const amp = 0.018 * intensity;
      return {
        ...layer,
        x: clamp01(layer.x + nx * amp),
        y: clamp01(layer.y + ny * amp),
      };
    }
    case 'bob': {
      const amp = 0.045 * intensity;
      return { ...layer, y: clamp01(layer.y + Math.sin(angle) * amp) };
    }
    case 'pulse': {
      const scale = 1 + Math.sin(angle) * 0.22 * intensity;
      return {
        ...layer,
        scaleX: layer.scaleX * scale,
        scaleY: layer.scaleY * scale,
      };
    }
    case 'spin': {
      // Intensity maps how many turns per full timeline cycle at speed 1.
      const turns = 1 + intensity * 2;
      return { ...layer, rotation: layer.rotation + clock * 360 * turns };
    }
    case 'shake': {
      const amp = 0.035 * intensity;
      return { ...layer, x: clamp01(layer.x + Math.sin(angle) * amp) };
    }
    case 'blink': {
      // Square-ish flicker: mostly on, dips toward transparent.
      const wave = Math.sin(angle);
      const dim = wave < 0 ? 1 - intensity * (-wave) : 1;
      return { ...layer, opacity: clamp(layer.opacity * dim, 0, 1) };
    }
    default:
      return layer;
  }
}

/** Apply enabled transform-tier effects after keyframe sampling. */
export function applyLayerEffects(layer: TextLayer, time: number): TextLayer {
  if (!layer.effects?.length) return layer;
  const t = clamp01(time);
  return layer.effects.reduce((current, effect) => applyOneEffect(current, effect, t), layer);
}
