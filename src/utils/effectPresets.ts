import {
  createLayerEffect,
  normalizeLayerEffect,
  type LayerEffect,
  type LayerEffectKind,
  type LayerEffectPreset,
} from '../types/crt';

const STORAGE_KEY = 'crtify.layerEffectPresets.v1';

export const BUILTIN_LAYER_EFFECT_PRESETS: LayerEffectPreset[] = [
  {
    id: 'vhs-titles',
    name: 'VHS Titles',
    builtin: true,
    effects: [
      createLayerEffect('trackingTear', { intensity: 0.55, speed: 1.1 }),
      createLayerEffect('rgbSplit', { intensity: 0.35, speed: 0.8 }),
      createLayerEffect('static', { intensity: 0.25, speed: 2 }),
    ],
  },
  {
    id: 'neon-pulse',
    name: 'Neon Pulse',
    builtin: true,
    effects: [
      createLayerEffect('colorCycle', { intensity: 0.6, speed: 0.5 }),
      createLayerEffect('pulse', { intensity: 0.3, speed: 1.4 }),
      createLayerEffect('bob', { intensity: 0.2, speed: 1.1 }),
    ],
  },
  {
    id: 'impact-sting',
    name: 'Impact Sting',
    builtin: true,
    effects: [
      createLayerEffect('impact', {
        intensity: 0.7,
        speed: 1.2,
        envelopeStart: 0.35,
        envelopeEnd: 0.65,
        fadeIn: 0.1,
        fadeOut: 0.25,
      }),
      createLayerEffect('shake', {
        intensity: 0.5,
        speed: 3,
        envelopeStart: 0.35,
        envelopeEnd: 0.7,
        fadeOut: 0.3,
      }),
    ],
  },
  {
    id: 'decode-text',
    name: 'Decode Text',
    builtin: true,
    effects: [
      createLayerEffect('scramble', { intensity: 0.9, speed: 1.2 }),
      createLayerEffect('typewriter', { intensity: 1, speed: 0.65 }),
      createLayerEffect('scanWipe', { intensity: 0.8, speed: 0.7 }),
    ],
  },
  {
    id: 'haunted-titles',
    name: 'Haunted Titles',
    builtin: true,
    effects: [
      createLayerEffect('glitch', { intensity: 0.55, speed: 1.6 }),
      createLayerEffect('rgbSplit', { intensity: 0.45, speed: 1.1 }),
      createLayerEffect('blink', { intensity: 0.55, speed: 1.4 }),
      createLayerEffect('static', { intensity: 0.3, speed: 2.2 }),
    ],
  },
  {
    id: 'terminal-boot',
    name: 'Terminal Boot',
    builtin: true,
    effects: [
      createLayerEffect('typewriter', { intensity: 1, speed: 0.55, envelopeEnd: 0.7 }),
      createLayerEffect('scanWipe', { intensity: 0.65, speed: 0.6, envelopeEnd: 0.75 }),
      createLayerEffect('shimmer', { intensity: 0.25, speed: 1.2 }),
    ],
  },
  {
    id: 'cyber-sting',
    name: 'Cyber Sting',
    builtin: true,
    effects: [
      createLayerEffect('colorCycle', { intensity: 0.7, speed: 0.8 }),
      createLayerEffect('impact', {
        intensity: 0.65,
        speed: 1.4,
        envelopeStart: 0.4,
        envelopeEnd: 0.7,
        fadeIn: 0.05,
        fadeOut: 0.3,
      }),
      createLayerEffect('rgbSplit', {
        intensity: 0.5,
        speed: 1.5,
        envelopeStart: 0.4,
        envelopeEnd: 0.75,
        fadeOut: 0.25,
      }),
    ],
  },
  {
    id: 'grain-hold',
    name: 'Grain Hold',
    builtin: true,
    effects: [
      createLayerEffect('filmGrain', { intensity: 0.55, speed: 1.4 }),
      createLayerEffect('holdTear', { intensity: 0.45, speed: 0.65 }),
      createLayerEffect('afterimage', { intensity: 0.4, speed: 1 }),
    ],
  },
  {
    id: 'chroma-fade',
    name: 'Chroma Fade',
    builtin: true,
    effects: [
      createLayerEffect('chromaticPulse', { intensity: 0.55, speed: 1 }),
      createLayerEffect('afterimage', { intensity: 0.5, speed: 0.9 }),
      createLayerEffect('echo', { intensity: 0.25, speed: 0.8 }),
    ],
  },
];

function readCustom(): LayerEffectPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LayerEffectPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((preset) => ({
      id: preset.id || crypto.randomUUID(),
      name: preset.name || 'Custom FX',
      builtin: false,
      effects: (preset.effects ?? [])
        .filter((effect) => effect?.kind)
        .map((effect) =>
          normalizeLayerEffect(effect as Partial<LayerEffect> & { kind: LayerEffectKind }),
        ),
    }));
  } catch {
    return [];
  }
}

function writeCustom(presets: LayerEffectPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function listLayerEffectPresets(): LayerEffectPreset[] {
  return [...BUILTIN_LAYER_EFFECT_PRESETS, ...readCustom()];
}

export function saveLayerEffectPreset(name: string, effects: LayerEffect[]): LayerEffectPreset {
  const preset: LayerEffectPreset = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Custom FX',
    builtin: false,
    effects: effects.map((effect) => normalizeLayerEffect({ ...effect, id: crypto.randomUUID() })),
  };
  writeCustom([...readCustom(), preset]);
  return preset;
}

export function deleteLayerEffectPreset(id: string) {
  writeCustom(readCustom().filter((preset) => preset.id !== id));
}

export function clonePresetEffects(preset: LayerEffectPreset): LayerEffect[] {
  return preset.effects.map((effect) =>
    normalizeLayerEffect({ ...effect, id: crypto.randomUUID() }),
  );
}
