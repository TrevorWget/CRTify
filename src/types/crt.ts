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

export type ExportFormat = 'png' | 'jpeg' | 'gif' | 'mp4' | 'webm';

export interface ExportProgress {
  stage: string;
  progress: number;
}
