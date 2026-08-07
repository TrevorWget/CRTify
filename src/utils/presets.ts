import {
  defaultCrtSettings,
  type CrtPreset,
  type CrtSettings,
  normalizeCrtSettings,
} from '../types/crt';

const CUSTOM_PRESETS_KEY = 'crtify.customPresets.v1';

export const BUILTIN_PRESETS: CrtPreset[] = [
  {
    id: 'default',
    name: 'Studio Default',
    description: 'A balanced, warm CRT starting point with moderate curvature and scanlines.',
    builtin: true,
    settings: { ...defaultCrtSettings },
  },
  {
    id: 'vhs-tape',
    name: 'VHS Tape',
    description: 'Noisy home-video playback with color separation, flicker, interlace, and roll.',
    builtin: true,
    settings: {
      ...defaultCrtSettings,
      curvature: 0.22,
      scanlineIntensity: 0.55,
      scanlineCount: 420,
      aberration: 0.008,
      vignette: 0.7,
      noise: 0.14,
      bloom: 0.15,
      tint: '#ffb070',
      tintStrength: 0.22,
      brightness: 0.95,
      contrast: 1.2,
      flicker: true,
      flickerIntensity: 0.06,
      rgbMask: 0.35,
      interlace: 0.45,
      rollBar: 0.25,
      phosphorDecay: 0.15,
      showBezel: true,
    },
  },
  {
    id: 'arcade',
    name: 'Arcade Cabinet',
    description: 'Punchy arcade phosphors with strong scanlines, RGB mask, glow, and curved glass.',
    builtin: true,
    settings: {
      ...defaultCrtSettings,
      curvature: 0.45,
      scanlineIntensity: 0.65,
      scanlineCount: 260,
      aberration: 0.004,
      vignette: 0.55,
      noise: 0.04,
      bloom: 0.45,
      tint: '#7dff9a',
      tintStrength: 0.28,
      brightness: 1.1,
      contrast: 1.25,
      rgbMask: 0.55,
      interlace: 0.2,
      rollBar: 0,
      phosphorDecay: 0.35,
      showBezel: true,
    },
  },
  {
    id: 'amber-terminal',
    name: 'Amber Terminal',
    description: 'Warm monochrome terminal glow with phosphor persistence and CRT-affected overlays.',
    builtin: true,
    settings: {
      ...defaultCrtSettings,
      curvature: 0.18,
      scanlineIntensity: 0.5,
      scanlineCount: 320,
      aberration: 0.001,
      vignette: 0.4,
      noise: 0.03,
      bloom: 0.35,
      tint: '#ffb000',
      tintStrength: 0.55,
      brightness: 1.05,
      contrast: 1.15,
      rgbMask: 0.15,
      interlace: 0.1,
      phosphorDecay: 0.45,
      showBezel: false,
    },
    crtAffectText: true,
  },
  {
    id: 'broadcast',
    name: 'Broadcast News',
    description: 'Clean studio video with fine scanlines, restrained color drift, and a TV bezel.',
    builtin: true,
    settings: {
      ...defaultCrtSettings,
      curvature: 0.12,
      scanlineIntensity: 0.25,
      scanlineCount: 480,
      aberration: 0.002,
      vignette: 0.35,
      noise: 0.02,
      bloom: 0.12,
      tint: '#dce8ff',
      tintStrength: 0.08,
      brightness: 1.05,
      contrast: 1.08,
      rgbMask: 0.2,
      interlace: 0.55,
      rollBar: 0.05,
      phosphorDecay: 0.05,
      showBezel: true,
    },
  },
  {
    id: 'security-cam',
    name: 'Security Cam',
    description: 'High-contrast surveillance feed with grain, heavy vignette, interlace, and sync roll.',
    builtin: true,
    settings: {
      ...defaultCrtSettings,
      curvature: 0.08,
      scanlineIntensity: 0.35,
      scanlineCount: 360,
      aberration: 0.0015,
      vignette: 0.8,
      noise: 0.18,
      bloom: 0.05,
      tint: '#c0c8b0',
      tintStrength: 0.35,
      brightness: 0.9,
      contrast: 1.35,
      flicker: true,
      flickerIntensity: 0.04,
      rgbMask: 0.1,
      interlace: 0.7,
      rollBar: 0.4,
      phosphorDecay: 0.1,
      showBezel: false,
    },
  },
];

function readCustomPresets(): CrtPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CrtPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((preset) => ({
      ...preset,
      builtin: false,
      settings: normalizeCrtSettings(preset.settings),
    }));
  } catch {
    return [];
  }
}

function writeCustomPresets(presets: CrtPreset[]) {
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

export function listPresets(): CrtPreset[] {
  return [...BUILTIN_PRESETS, ...readCustomPresets()];
}

export function saveCustomPreset(name: string, settings: CrtSettings, crtAffectText?: boolean): CrtPreset {
  const preset: CrtPreset = {
    id: `custom-${crypto.randomUUID()}`,
    name: name.trim() || 'Custom Look',
    description: 'A custom look saved from your current CRT effect settings.',
    builtin: false,
    settings: normalizeCrtSettings(settings),
    crtAffectText,
  };
  const next = [...readCustomPresets(), preset];
  writeCustomPresets(next);
  return preset;
}

export function deleteCustomPreset(id: string) {
  writeCustomPresets(readCustomPresets().filter((preset) => preset.id !== id));
}

export function findPreset(id: string): CrtPreset | undefined {
  return listPresets().find((preset) => preset.id === id);
}
