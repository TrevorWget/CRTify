export type MediaType = 'image' | 'gif' | 'webp' | 'video' | null;

export interface CrtSettings {
  curvature: number;
  scanlineIntensity: number;
  scanlineCount: number;
  aberration: number;
  vignette: number;
  noise: number;
  bloom: number;
  tint: string;
  tintStrength: number;
  brightness: number;
  contrast: number;
  flicker: boolean;
  flickerIntensity: number;
  /** RGB aperture grille / shadow-mask strength (0–1). */
  rgbMask: number;
  /** Interlace field darkening (0–1). */
  interlace: number;
  /** Vertical rolling sync offset strength (0–1). */
  rollBar: number;
  /** Phosphor persistence / decay trail (0–1). */
  phosphorDecay: number;
  /** Composite a TV chrome bezel around exports/preview. */
  showBezel: boolean;
}

export const defaultCrtSettings: CrtSettings = {
  curvature: 0.3,
  scanlineIntensity: 0.4,
  scanlineCount: 300,
  aberration: 0.003,
  vignette: 0.5,
  noise: 0.05,
  bloom: 0.2,
  tint: '#ff9a1f',
  tintStrength: 0.15,
  brightness: 1.0,
  contrast: 1.1,
  flicker: false,
  flickerIntensity: 0.05,
  rgbMask: 0,
  interlace: 0,
  rollBar: 0,
  phosphorDecay: 0,
  showBezel: false,
};

export const BUILTIN_FONTS = [
  'VT323',
  'Press Start 2P',
  'Bungee',
  'Audiowide',
  'Orbitron',
  'Black Ops One',
  'Share Tech Mono',
  'monospace',
] as const;

export type BuiltinFontFamily = (typeof BUILTIN_FONTS)[number];
export type FontFamily = BuiltinFontFamily | (string & {});

export type TextAlignment = 'left' | 'center' | 'right';
export type OverlayLayerKind = 'text' | 'image' | 'shape';
export type ShapeKind =
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'star'
  | 'heart'
  | 'plus'
  | 'speech'
  | 'rewind'
  | 'fastforward'
  | 'diamond'
  | 'hexagon'
  | 'arrow';

export const SHAPE_OPTIONS: { id: ShapeKind; label: string }[] = [
  { id: 'rect', label: 'Rect' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'hexagon', label: 'Hex' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'plus', label: 'Plus' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'speech', label: 'Speech' },
  { id: 'rewind', label: 'Rewind' },
  { id: 'fastforward', label: 'FF' },
];

/** Normalized timeline keyframe (t in 0–1 across media duration / loop). */
export interface LayerKeyframe {
  /** Stable identity so rows keep focus while `t` is edited and the list re-sorts. */
  id?: string;
  t: number;
  x?: number;
  y?: number;
  opacity?: number;
}

/** Procedural transform animations applied after keyframe sampling. */
export type LayerEffectKind =
  | 'jitter'
  | 'bob'
  | 'pulse'
  | 'spin'
  | 'shake'
  | 'blink'
  | 'glitch'
  | 'static'
  | 'rgbSplit'
  | 'echo'
  | 'wave'
  | 'ripple'
  | 'bulge'
  | 'shimmer'
  | 'trackingTear'
  | 'datamosh'
  | 'scanWipe'
  | 'colorCycle'
  | 'typewriter'
  | 'scramble'
  | 'impact'
  | 'tilt'
  | 'mirrorFlash';

export interface LayerEffect {
  id: string;
  kind: LayerEffectKind;
  enabled: boolean;
  /** 0–1 strength. */
  intensity: number;
  /** Relative speed multiplier (typical useful range ~0.25–4). */
  speed: number;
  /** 0–1 phase offset so stacked effects don't lock in sync. */
  phase: number;
  /** Normalized timeline where the effect becomes active (default 0). */
  envelopeStart: number;
  /** Normalized timeline where the effect ends (default 1). */
  envelopeEnd: number;
  /** Fade-in as a fraction of the active window (0–0.5). */
  fadeIn: number;
  /** Fade-out as a fraction of the active window (0–0.5). */
  fadeOut: number;
}

export const LAYER_EFFECT_OPTIONS: ReadonlyArray<{
  id: LayerEffectKind;
  label: string;
  description: string;
}> = [
  { id: 'jitter', label: 'Jitter', description: 'Tiny random position noise' },
  { id: 'bob', label: 'Bob', description: 'Smooth vertical sine motion' },
  { id: 'pulse', label: 'Pulse', description: 'Scale pop in and out' },
  { id: 'spin', label: 'Spin', description: 'Continuous rotation' },
  { id: 'shake', label: 'Shake', description: 'Horizontal vibration' },
  { id: 'blink', label: 'Blink', description: 'Opacity flicker' },
  { id: 'glitch', label: 'Glitch', description: 'Jumping horizontal slices' },
  { id: 'static', label: 'Static', description: 'Seeded analog noise speckles' },
  { id: 'rgbSplit', label: 'RGB Split', description: 'Offset red and cyan echoes' },
  { id: 'echo', label: 'Echo', description: 'Trailing translucent copies' },
  { id: 'wave', label: 'Wave', description: 'Sine-wave image displacement' },
  { id: 'ripple', label: 'Ripple', description: 'Concentric animated ripples' },
  { id: 'bulge', label: 'Bulge', description: 'Breathing lens distortion' },
  { id: 'shimmer', label: 'Shimmer', description: 'Fine heat-haze distortion' },
  { id: 'trackingTear', label: 'Tracking', description: 'VHS tracking tear bands' },
  { id: 'datamosh', label: 'Datamosh', description: 'Smear held pixels from prior frames' },
  { id: 'scanWipe', label: 'Scan Wipe', description: 'Sweeping reveal across the layer' },
  { id: 'colorCycle', label: 'Color Cycle', description: 'Hue-shifting neon color wash' },
  { id: 'typewriter', label: 'Typewriter', description: 'Reveal text characters over time' },
  { id: 'scramble', label: 'Scramble', description: 'Decode scrambled characters into text' },
  { id: 'impact', label: 'Impact', description: 'Sharp one-shot scale punch' },
  { id: 'tilt', label: 'Tilt', description: 'Perspective-style skew rock' },
  { id: 'mirrorFlash', label: 'Mirror', description: 'Flashing horizontal mirror flips' },
];

export interface LayerEffectPreset {
  id: string;
  name: string;
  effects: LayerEffect[];
  builtin?: boolean;
}

export interface TextLayer {
  id: string;
  kind: OverlayLayerKind;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: FontFamily;
  textAlign: TextAlignment;
  glow: number;
  blur: number;
  brightness: number;
  strokeWidth: number;
  strokeColor: string;
  letterSpacing: number;
  lineHeight: number;
  warp: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skew: number;
  opacity: number;
  locked: boolean;
  shape?: ShapeKind;
  /** Object URL or data URL for sticker/image layers. */
  imageUrl?: string;
  /** Runtime-only decoded image for stickers. */
  imageElement?: HTMLImageElement;
  keyframes: LayerKeyframe[];
  effects: LayerEffect[];
}

export interface GifFrame {
  imageData: ImageData;
  delay: number;
}

export interface LoadedMedia {
  type: MediaType;
  width: number;
  height: number;
  image?: HTMLImageElement;
  gifFrames?: GifFrame[];
  video?: HTMLVideoElement;
  objectUrl?: string;
  /** Original file bytes retained for audio remux / project metadata. */
  sourceFile?: File;
  fileName?: string;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'mp4' | 'webm';

export interface ExportOptionsConfig {
  filename: string;
  /** Exact output scale as a percentage of source resolution (10–100). */
  scalePercent: number;
  /** JPEG/WebP quality from 0.5–1. */
  imageQuality: number;
  /** gif.js sample interval; lower is better color, larger files (1–30). */
  gifQuality: number;
  /** Keep every Nth frame when exporting GIF/video (1 = all frames). */
  frameSkip: number;
  /** Optional GIF dithering for smoother gradients at a size cost. */
  dither: boolean;
  /** Prefer smaller video encodes (lower bitrate / higher CRF / fewer fps). */
  optimizeVideo: boolean;
  /** Keep source audio track when exporting MP4/WebM from video. */
  keepAudio: boolean;
}

export const defaultExportOptions = (): Omit<ExportOptionsConfig, 'filename'> => ({
  scalePercent: 100,
  imageQuality: 0.92,
  gifQuality: 10,
  frameSkip: 1,
  dither: false,
  optimizeVideo: false,
  keepAudio: true,
});

export interface ExportRecipe {
  id: string;
  name: string;
  description?: string;
  format: ExportFormat;
  options: Omit<ExportOptionsConfig, 'filename'> & { filename?: string };
  builtin?: boolean;
}

export interface ExportQueueItem {
  id: string;
  label: string;
  format: ExportFormat;
  options: ExportOptionsConfig;
  status: 'queued' | 'running' | 'done' | 'error';
  error?: string;
}

export interface ExportProgress {
  stage: string;
  progress: number;
}

export interface CrtPreset {
  id: string;
  name: string;
  /** Short human-readable explanation shown on hover. */
  description?: string;
  builtin?: boolean;
  settings: CrtSettings;
  crtAffectText?: boolean;
}

export interface CrtifyProjectV1 {
  version: 1;
  name?: string;
  settings: CrtSettings;
  crtAffectText: boolean;
  textLayers: Array<Omit<TextLayer, 'imageElement'>>;
  exportOptions?: Partial<ExportOptionsConfig>;
  mediaHint?: {
    type: MediaType;
    width: number;
    height: number;
    fileName?: string;
  };
}

export function createTextLayer(partial: Partial<TextLayer> = {}): TextLayer {
  return {
    id: crypto.randomUUID(),
    kind: 'text',
    text: 'CRT TEXT',
    x: 0.1,
    y: 0.1,
    fontSize: 32,
    color: '#fff4d6',
    fontFamily: 'VT323',
    textAlign: 'left',
    glow: 10,
    blur: 0,
    brightness: 1,
    strokeWidth: 0,
    strokeColor: '#e63415',
    letterSpacing: 0,
    lineHeight: 1.15,
    warp: defaultCrtSettings.curvature,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    skew: 0,
    opacity: 1,
    locked: false,
    keyframes: [],
    effects: [],
    ...partial,
  };
}

export function createShapeLayer(shape: ShapeKind = 'rect'): TextLayer {
  return createTextLayer({
    kind: 'shape',
    shape,
    text: '',
    color: '#ffb000',
    opacity: 0.85,
    scaleX: 0.35,
    scaleY: 0.18,
    glow: 0,
    warp: 0,
  });
}

export function normalizeCrtSettings(input: Partial<CrtSettings> | null | undefined): CrtSettings {
  return { ...defaultCrtSettings, ...(input ?? {}) };
}

export function normalizeLayerEffect(input: Partial<LayerEffect> & { kind: LayerEffectKind }): LayerEffect {
  const start = Math.min(1, Math.max(0, input.envelopeStart ?? 0));
  const end = Math.min(1, Math.max(start, input.envelopeEnd ?? 1));
  return {
    id: input.id ?? crypto.randomUUID(),
    kind: input.kind,
    enabled: input.enabled ?? true,
    intensity: Math.min(1, Math.max(0, input.intensity ?? 0.5)),
    speed: Math.min(8, Math.max(0.05, input.speed ?? 1)),
    phase: Math.min(1, Math.max(0, input.phase ?? 0)),
    envelopeStart: start,
    envelopeEnd: end,
    fadeIn: Math.min(0.5, Math.max(0, input.fadeIn ?? 0)),
    fadeOut: Math.min(0.5, Math.max(0, input.fadeOut ?? 0)),
  };
}

export function createLayerEffect(kind: LayerEffectKind, partial: Partial<LayerEffect> = {}): LayerEffect {
  const defaults: Record<LayerEffectKind, Pick<LayerEffect, 'intensity' | 'speed' | 'phase'>> = {
    jitter: { intensity: 0.35, speed: 1.5, phase: 0 },
    bob: { intensity: 0.4, speed: 1, phase: 0 },
    pulse: { intensity: 0.35, speed: 1.2, phase: 0 },
    spin: { intensity: 0.5, speed: 0.75, phase: 0 },
    shake: { intensity: 0.45, speed: 2.2, phase: 0 },
    blink: { intensity: 0.7, speed: 1.8, phase: 0 },
    glitch: { intensity: 0.45, speed: 1.5, phase: 0 },
    static: { intensity: 0.35, speed: 2, phase: 0 },
    rgbSplit: { intensity: 0.4, speed: 1, phase: 0 },
    echo: { intensity: 0.35, speed: 1, phase: 0 },
    wave: { intensity: 0.4, speed: 1, phase: 0 },
    ripple: { intensity: 0.35, speed: 1, phase: 0 },
    bulge: { intensity: 0.35, speed: 0.75, phase: 0 },
    shimmer: { intensity: 0.3, speed: 1.5, phase: 0 },
    trackingTear: { intensity: 0.5, speed: 1.2, phase: 0 },
    datamosh: { intensity: 0.45, speed: 1, phase: 0 },
    scanWipe: { intensity: 0.7, speed: 0.8, phase: 0 },
    colorCycle: { intensity: 0.55, speed: 0.6, phase: 0 },
    typewriter: { intensity: 1, speed: 0.7, phase: 0 },
    scramble: { intensity: 0.85, speed: 0.9, phase: 0 },
    impact: { intensity: 0.55, speed: 1.4, phase: 0 },
    tilt: { intensity: 0.4, speed: 0.9, phase: 0 },
    mirrorFlash: { intensity: 1, speed: 1.6, phase: 0 },
  };
  return normalizeLayerEffect({ kind, ...defaults[kind], ...partial });
}

export function duplicateTextLayer(layer: TextLayer): TextLayer {
  return {
    ...layer,
    id: crypto.randomUUID(),
    keyframes: layer.keyframes.map((frame) => ({
      ...frame,
      id: crypto.randomUUID(),
    })),
    effects: layer.effects.map((effect) =>
      normalizeLayerEffect({ ...effect, id: crypto.randomUUID() }),
    ),
  };
}

export function normalizeTextLayer(input: Partial<TextLayer> & { id?: string }): TextLayer {
  const base = createTextLayer({ id: input.id ?? crypto.randomUUID() });
  const keyframes = (input.keyframes ?? [])
    .map((frame) => ({ ...frame, id: frame.id ?? crypto.randomUUID() }))
    .sort((a, b) => a.t - b.t);
  const effects = (input.effects ?? [])
    .filter((effect) => Boolean(effect?.kind))
    .map((effect) =>
      normalizeLayerEffect(effect as Partial<LayerEffect> & { kind: LayerEffectKind }),
    );
  const merged = { ...base, ...input, keyframes, effects };
  if (!merged.kind) merged.kind = merged.imageUrl ? 'image' : merged.shape ? 'shape' : 'text';
  return merged;
}
