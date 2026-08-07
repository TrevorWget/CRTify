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

export function effectClock(effect: LayerEffect, time: number): number {
  return (time * effect.speed + effect.phase) % 1;
}

/** 0 outside the envelope window; ramps through fadeIn/fadeOut inside it. */
export function effectEnvelopeGain(effect: LayerEffect, time: number): number {
  const t = clamp01(time);
  const start = clamp01(effect.envelopeStart ?? 0);
  const end = Math.max(start, clamp01(effect.envelopeEnd ?? 1));
  if (t < start || t > end) return 0;
  if (end <= start) return 1;
  const span = end - start;
  const local = (t - start) / span;
  const fadeIn = Math.min(0.5, Math.max(0, effect.fadeIn ?? 0));
  const fadeOut = Math.min(0.5, Math.max(0, effect.fadeOut ?? 0));
  let gain = 1;
  if (fadeIn > 0 && local < fadeIn) gain = Math.min(gain, local / fadeIn);
  if (fadeOut > 0 && local > 1 - fadeOut) gain = Math.min(gain, (1 - local) / fadeOut);
  return clamp01(gain);
}

export function effectiveIntensity(effect: LayerEffect, time: number): number {
  if (!effect.enabled) return 0;
  return clamp01(effect.intensity) * effectEnvelopeGain(effect, time);
}

function applyOneEffect(layer: TextLayer, effect: LayerEffect, time: number): TextLayer {
  const intensity = effectiveIntensity(effect, time);
  if (intensity <= 0) return layer;

  const clock = effectClock(effect, time);
  const angle = clock * Math.PI * 2;

  switch (effect.kind) {
    case 'jitter': {
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
      const turns = 1 + intensity * 2;
      return { ...layer, rotation: layer.rotation + clock * 360 * turns };
    }
    case 'shake': {
      const amp = 0.035 * intensity;
      return { ...layer, x: clamp01(layer.x + Math.sin(angle) * amp) };
    }
    case 'blink': {
      const wave = Math.sin(angle);
      const dim = wave < 0 ? 1 - intensity * -wave : 1;
      return { ...layer, opacity: clamp(layer.opacity * dim, 0, 1) };
    }
    case 'impact': {
      // Narrow punches several times per cycle; envelope gates the whole effect.
      const punch = Math.pow(Math.max(0, Math.sin(angle * 2)), 18);
      const scale = 1 + punch * 0.55 * intensity;
      return {
        ...layer,
        scaleX: layer.scaleX * scale,
        scaleY: layer.scaleY * scale,
      };
    }
    case 'tilt': {
      const skew = Math.sin(angle) * 28 * intensity;
      const tip = Math.sin(angle + Math.PI / 2) * 8 * intensity;
      return {
        ...layer,
        skew: layer.skew + skew,
        rotation: layer.rotation + tip,
      };
    }
    case 'mirrorFlash': {
      const flipped = Math.sin(angle) > 0;
      return flipped ? { ...layer, scaleX: -Math.abs(layer.scaleX) } : layer;
    }
    default:
      return layer;
  }
}

/** One-shot 0→1 progress for text reveal effects; holds at 1 after completion. */
function textEffectProgress(effect: LayerEffect, time: number): number {
  if (!effect.enabled) return 0;

  const t = clamp01(time);
  const start = clamp01(effect.envelopeStart ?? 0);
  const end = Math.max(start, clamp01(effect.envelopeEnd ?? 1));

  if (t < start) return 0;
  if (t >= end) return 1;

  const gain = effectEnvelopeGain(effect, time);
  if (gain <= 0) return 0;

  const span = Math.max(1e-6, end - start);
  const local = (t - start) / span;
  const phase = clamp01(effect.phase);
  const delay = phase * 0.95;
  const windowSpan = Math.max(1e-6, 1 - delay);
  const driven = clamp01((local - delay) / windowSpan);
  const speed = Math.max(0.05, effect.speed);
  return clamp01(driven * speed);
}

/** Apply enabled transform-tier effects after keyframe sampling. */
export function applyLayerEffects(layer: TextLayer, time: number): TextLayer {
  if (!layer.effects?.length) return layer;
  const t = clamp01(time);
  return layer.effects.reduce((current, effect) => applyOneEffect(current, effect, t), layer);
}

const SCRAMBLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&*';

/** Resolve typewriter / scramble text for the current playhead. */
export function resolveEffectText(layer: TextLayer, time: number): string {
  if (layer.kind !== 'text' || !layer.text) return layer.text;
  const typewriter = (layer.effects ?? []).find((effect) => effect.kind === 'typewriter');
  const scramble = (layer.effects ?? []).find((effect) => effect.kind === 'scramble');
  if (!typewriter && !scramble) return layer.text;

  const chars = [...layer.text];
  const total = Math.max(1, chars.filter((ch) => ch.trim()).length);

  const typewriterProgress = typewriter ? textEffectProgress(typewriter, time) : 1;
  const scrambleProgress = scramble ? textEffectProgress(scramble, time) : 1;

  if (typewriter && typewriterProgress <= 0 && scrambleProgress <= 0) return '';

  const revealProgress = typewriter ? typewriterProgress : scrambleProgress;
  const revealed =
    revealProgress >= 1 ? total : Math.min(total, Math.ceil(total * revealProgress - 1e-9));

  let seen = 0;
  const scrambleIntensity = scramble ? clamp01(scramble.intensity) : 0;
  const scrambleStep = scramble
    ? Math.floor(time * 18 * Math.max(0.05, scramble.speed))
    : 0;

  return chars
    .map((ch, index) => {
      if (!ch.trim()) return ch;
      const order = seen++;
      if (order < revealed) return ch;

      const settling = scramble && scrambleProgress < 1;
      if (!settling) return typewriter ? '' : ch;

      const shuffleRate = 1 + scrambleIntensity * 5;
      const pick = Math.floor(
        hash01(`${layer.id}:scramble:${Math.floor(scrambleStep * shuffleRate)}:${index}`) *
          SCRAMBLE_GLYPHS.length,
      );
      return SCRAMBLE_GLYPHS[pick] ?? '#';
    })
    .join('');
}
