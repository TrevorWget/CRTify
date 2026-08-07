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
export type ShapeKind = 'rect' | 'ellipse';

/** Normalized timeline keyframe (t in 0–1 across media duration / loop). */
export interface LayerKeyframe {
  t: number;
  x?: number;
  y?: number;
  opacity?: number;
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

export interface ExportProgress {
  stage: string;
  progress: number;
}

export interface CrtPreset {
  id: string;
  name: string;
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

export function normalizeTextLayer(input: Partial<TextLayer> & { id?: string }): TextLayer {
  const base = createTextLayer({ id: input.id ?? crypto.randomUUID() });
  const merged = { ...base, ...input, keyframes: input.keyframes ?? [] };
  if (!merged.kind) merged.kind = merged.imageUrl ? 'image' : merged.shape ? 'shape' : 'text';
  return merged;
}
