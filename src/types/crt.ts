export type MediaType = 'image' | 'gif' | 'video' | null;

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
};

export type FontFamily =
  | 'VT323'
  | 'Press Start 2P'
  | 'Bungee'
  | 'Audiowide'
  | 'Orbitron'
  | 'Black Ops One'
  | 'Share Tech Mono'
  | 'monospace';

export type TextAlignment = 'left' | 'center' | 'right';

export interface TextLayer {
  id: string;
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
  warp: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skew: number;
  opacity: number;
  locked: boolean;
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
}

export const defaultExportOptions = (): Omit<ExportOptionsConfig, 'filename'> => ({
  scalePercent: 100,
  imageQuality: 0.92,
  gifQuality: 10,
  frameSkip: 1,
  dither: false,
  optimizeVideo: false,
});

export interface ExportProgress {
  stage: string;
  progress: number;
}
