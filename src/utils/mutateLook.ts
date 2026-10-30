import type { CrtSettings } from '../types/crt';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function jitter(value: number, amount: number, min: number, max: number) {
  const delta = (Math.random() * 2 - 1) * amount;
  return clamp(value + delta, min, max);
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return [255, 176, 0];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (channel: number) =>
    Math.round(clamp(channel, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

/** Nudge CRT knobs around the current look for quick exploration. */
export function mutateLook(settings: CrtSettings, strength = 0.35): CrtSettings {
  const s = clamp(strength, 0.1, 1);
  const [r, g, b] = hexToRgb(settings.tint);
  const tintJitter = 28 * s;

  return {
    ...settings,
    curvature: jitter(settings.curvature, 0.12 * s, 0, 0.85),
    scanlineIntensity: jitter(settings.scanlineIntensity, 0.18 * s, 0, 1),
    scanlineCount: Math.round(jitter(settings.scanlineCount, 80 * s, 120, 560)),
    aberration: jitter(settings.aberration, 0.004 * s, 0, 0.02),
    vignette: jitter(settings.vignette, 0.18 * s, 0, 1),
    noise: jitter(settings.noise, 0.08 * s, 0, 0.4),
    bloom: jitter(settings.bloom, 0.16 * s, 0, 0.8),
    tint: rgbToHex(
      r + (Math.random() * 2 - 1) * tintJitter,
      g + (Math.random() * 2 - 1) * tintJitter,
      b + (Math.random() * 2 - 1) * tintJitter,
    ),
    tintStrength: jitter(settings.tintStrength, 0.12 * s, 0, 0.85),
    brightness: jitter(settings.brightness, 0.1 * s, 0.6, 1.4),
    contrast: jitter(settings.contrast, 0.12 * s, 0.7, 1.6),
    flicker: Math.random() < 0.15 * s ? !settings.flicker : settings.flicker,
    flickerIntensity: jitter(settings.flickerIntensity, 0.04 * s, 0, 0.2),
    rgbMask: jitter(settings.rgbMask, 0.15 * s, 0, 0.85),
    interlace: jitter(settings.interlace, 0.18 * s, 0, 1),
    rollBar: jitter(settings.rollBar, 0.14 * s, 0, 0.7),
    phosphorDecay: jitter(settings.phosphorDecay, 0.14 * s, 0, 0.7),
    showBezel: Math.random() < 0.12 * s ? !settings.showBezel : settings.showBezel,
  };
}

/** Stronger reshuffle that keeps the same general palette family. */
export function randomizeLook(settings: CrtSettings): CrtSettings {
  return mutateLook(settings, 0.85);
}
