import {
  createLayerEffect,
  createTextLayer,
  type CrtSettings,
  type TextLayer,
} from '../types/crt';
import { findPreset } from './presets';

export interface SceneKit {
  id: string;
  name: string;
  description: string;
  /** Built-in look preset id, or null to keep current settings. */
  lookId: string | null;
  crtAffectText?: boolean;
  layers: () => TextLayer[];
}

function lookSettings(lookId: string): CrtSettings | null {
  return findPreset(lookId)?.settings ?? null;
}

/** Resolve a kit into concrete settings + layers for App to apply. */
export function resolveSceneKit(kit: SceneKit): {
  settings?: CrtSettings;
  crtAffectText?: boolean;
  layers: TextLayer[];
} {
  const settings = kit.lookId ? lookSettings(kit.lookId) ?? undefined : undefined;
  return {
    settings: settings ? { ...settings } : undefined,
    crtAffectText: kit.crtAffectText,
    layers: kit.layers().map((layer) => ({
      ...layer,
      id: crypto.randomUUID(),
      effects: layer.effects.map((effect) => ({ ...effect, id: crypto.randomUUID() })),
      keyframes: layer.keyframes.map((frame) => ({ ...frame, id: crypto.randomUUID() })),
    })),
  };
}

export const SCENE_KITS: SceneKit[] = [
  {
    id: 'vhs-title-card',
    name: 'VHS Title Card',
    description: 'VHS Tape look with tracking-torn centered title.',
    lookId: 'vhs-tape',
    crtAffectText: true,
    layers: () => [
      createTextLayer({
        text: 'PLAY ME',
        x: 0.5,
        y: 0.42,
        fontSize: 56,
        fontFamily: 'VT323',
        textAlign: 'center',
        color: '#fff4d6',
        glow: 14,
        strokeWidth: 2,
        strokeColor: '#3a1808',
        effects: [
          createLayerEffect('trackingTear', { intensity: 0.5, speed: 1.1 }),
          createLayerEffect('rgbSplit', { intensity: 0.3, speed: 0.9 }),
          createLayerEffect('static', { intensity: 0.2, speed: 2 }),
        ],
      }),
      createTextLayer({
        text: 'TRACK 01',
        x: 0.5,
        y: 0.62,
        fontSize: 22,
        fontFamily: 'Share Tech Mono',
        textAlign: 'center',
        color: '#ffb070',
        glow: 4,
        effects: [createLayerEffect('blink', { intensity: 0.45, speed: 1.2 })],
      }),
    ],
  },
  {
    id: 'terminal-boot',
    name: 'Terminal Boot',
    description: 'Green phosphor boot sequence with typewriter text.',
    lookId: 'green-phosphor',
    crtAffectText: true,
    layers: () => [
      createTextLayer({
        text: '> SYSTEM READY\n> LOADING KERNEL…\n> OK',
        x: 0.08,
        y: 0.22,
        fontSize: 28,
        fontFamily: 'Share Tech Mono',
        textAlign: 'left',
        color: '#9dffb0',
        glow: 12,
        lineHeight: 1.35,
        effects: [
          createLayerEffect('typewriter', { intensity: 1, speed: 0.55, envelopeEnd: 0.75 }),
          createLayerEffect('scanWipe', { intensity: 0.55, speed: 0.55, envelopeEnd: 0.8 }),
          createLayerEffect('shimmer', { intensity: 0.2, speed: 1.1 }),
        ],
      }),
    ],
  },
  {
    id: 'neon-sting',
    name: 'Neon Sting',
    description: 'Neon Cyber look with color-cycled impact title.',
    lookId: 'neon-cyber',
    crtAffectText: true,
    layers: () => [
      createTextLayer({
        text: 'SIGNAL',
        x: 0.5,
        y: 0.48,
        fontSize: 64,
        fontFamily: 'Orbitron',
        textAlign: 'center',
        color: '#ff7ae8',
        glow: 22,
        effects: [
          createLayerEffect('colorCycle', { intensity: 0.65, speed: 0.7 }),
          createLayerEffect('impact', {
            intensity: 0.7,
            speed: 1.3,
            envelopeStart: 0.35,
            envelopeEnd: 0.7,
            fadeIn: 0.05,
            fadeOut: 0.3,
          }),
          createLayerEffect('rgbSplit', {
            intensity: 0.45,
            speed: 1.4,
            envelopeStart: 0.35,
            envelopeEnd: 0.75,
          }),
        ],
      }),
    ],
  },
  {
    id: 'broadcast-lower-third',
    name: 'Broadcast Lower Third',
    description: 'Clean news look with a lower-third nameplate.',
    lookId: 'broadcast',
    crtAffectText: false,
    layers: () => [
      createTextLayer({
        kind: 'shape',
        shape: 'rect',
        text: '',
        x: 0.28,
        y: 0.78,
        color: '#e63415',
        opacity: 0.9,
        scaleX: 0.42,
        scaleY: 0.08,
        glow: 0,
        warp: 0,
        crtAffect: false,
      }),
      createTextLayer({
        text: 'LIVE · FIELD REPORT',
        x: 0.1,
        y: 0.76,
        fontSize: 18,
        fontFamily: 'Share Tech Mono',
        textAlign: 'left',
        color: '#fff4d6',
        glow: 2,
        crtAffect: false,
      }),
      createTextLayer({
        text: 'CHANNEL 09',
        x: 0.1,
        y: 0.84,
        fontSize: 28,
        fontFamily: 'VT323',
        textAlign: 'left',
        color: '#fff4d6',
        glow: 6,
        crtAffect: false,
      }),
    ],
  },
  {
    id: 'haunted-signal',
    name: 'Haunted Signal',
    description: 'Broken CRT look with glitching cryptic message.',
    lookId: 'haunted-crt',
    crtAffectText: true,
    layers: () => [
      createTextLayer({
        text: 'DO NOT LOOK AWAY',
        x: 0.5,
        y: 0.5,
        fontSize: 40,
        fontFamily: 'Black Ops One',
        textAlign: 'center',
        color: '#c8ff9a',
        glow: 16,
        effects: [
          createLayerEffect('glitch', { intensity: 0.55, speed: 1.5 }),
          createLayerEffect('scramble', { intensity: 0.8, speed: 1.1, envelopeEnd: 0.55 }),
          createLayerEffect('typewriter', { intensity: 1, speed: 0.7, envelopeEnd: 0.6 }),
          createLayerEffect('static', { intensity: 0.35, speed: 2.2 }),
        ],
      }),
    ],
  },
  {
    id: 'security-timestamp',
    name: 'Security Timestamp',
    description: 'Surveillance cam look with REC badge and clock.',
    lookId: 'security-cam',
    crtAffectText: true,
    layers: () => [
      createTextLayer({
        text: '● REC',
        x: 0.08,
        y: 0.1,
        fontSize: 22,
        fontFamily: 'Share Tech Mono',
        textAlign: 'left',
        color: '#ff4040',
        glow: 8,
        effects: [createLayerEffect('blink', { intensity: 0.85, speed: 1.6 })],
      }),
      createTextLayer({
        text: 'CAM 03  00:00:00',
        x: 0.08,
        y: 0.88,
        fontSize: 20,
        fontFamily: 'Share Tech Mono',
        textAlign: 'left',
        color: '#d0d8c0',
        glow: 4,
        effects: [createLayerEffect('static', { intensity: 0.15, speed: 1.8 })],
      }),
    ],
  },
];

export function listSceneKits(): SceneKit[] {
  return SCENE_KITS;
}
