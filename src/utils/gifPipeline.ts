import GIF from 'gif.js';
import type { CrtSettings, ExportProgress, GifFrame, TextLayer } from '../types/crt';
import { applyBezelChrome } from './bezelOverlay';
import { resolveLayersAtTime } from './keyframes';
import { CrtRenderer } from './webgl';
import { drawTextLayers } from './textCompositor';
import { imageDataToCanvas } from './mediaLoader';
import { percentToScale } from './imageExport';

const frameCanvas = document.createElement('canvas');
const frameCtx = frameCanvas.getContext('2d')!;
const encodeCanvas = document.createElement('canvas');
const encodeCtx = encodeCanvas.getContext('2d', { willReadFrequently: true })!;

// gif.js resolves the transparent palette entry with a brute-force Euclidean
// search while it indexes pixels through NeuQuant's approximate lookup. Those
// two searches can land on different entries when several palette colors sit
// near the key, which makes transparent areas flash the key color on individual
// frames. Keeping every opaque pixel outside a wide guard band around pure
// green leaves a single candidate, so both searches agree on every frame.
const KEY_R = 0;
const KEY_G = 255;
const KEY_B = 0;
const GIF_TRANSPARENT_COLOR = (KEY_R << 16) | (KEY_G << 8) | KEY_B;
const GUARD_BAND = 100;
const ALPHA_CUTOFF = 128;

export interface GifExportSettings {
  scalePercent: number;
  gifQuality: number;
  frameSkip: number;
  dither: boolean;
}

function sourceHasTransparency(frames: GifFrame[]): boolean {
  for (const frame of frames) {
    const data = frame.imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  }
  return false;
}

function applyTransparencyKey(imageData: ImageData) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_CUTOFF) {
      data[i] = KEY_R;
      data[i + 1] = KEY_G;
      data[i + 2] = KEY_B;
    } else if (
      data[i] < GUARD_BAND &&
      data[i + 1] > KEY_G - GUARD_BAND &&
      data[i + 2] < GUARD_BAND
    ) {
      data[i + 1] = KEY_G - GUARD_BAND;
    }
    data[i + 3] = 255;
  }
}

export async function exportGif(
  frames: GifFrame[],
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  onProgress: (progress: ExportProgress) => void,
  exportSettings: GifExportSettings,
): Promise<Blob> {
  const renderer = new CrtRenderer();
  const sourceWidth = frames[0].imageData.width;
  const sourceHeight = frames[0].imageData.height;
  const scale = percentToScale(exportSettings.scalePercent);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const frameSkip = Math.max(1, Math.round(exportSettings.frameSkip));
  const quality = Math.min(30, Math.max(1, Math.round(exportSettings.gifQuality)));

  frameCanvas.width = sourceWidth;
  frameCanvas.height = sourceHeight;
  encodeCanvas.width = width;
  encodeCanvas.height = height;

  const usesTransparency = settings.curvature > 0 || sourceHasTransparency(frames);
  const selectedIndexes: number[] = [];
  for (let i = 0; i < frames.length; i += frameSkip) {
    selectedIndexes.push(i);
  }
  if (selectedIndexes[selectedIndexes.length - 1] !== frames.length - 1) {
    selectedIndexes.push(frames.length - 1);
  }

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality,
      width,
      height,
      dither: exportSettings.dither ? 'FloydSteinberg' : false,
      // gif.js expects a numeric RGB value at runtime; its community typings
      // incorrectly declare this option as a string.
      transparent: usesTransparency ? (GIF_TRANSPARENT_COLOR as unknown as string) : null,
      workerScript: `${import.meta.env.BASE_URL}gif.worker.js`,
    });

    gif.on('finished', (blob: Blob) => {
      renderer.destroy();
      resolve(blob);
    });

    gif.on('progress', (p: number) => {
      onProgress({ stage: 'Encoding GIF', progress: 0.5 + p * 0.5 });
    });

    (async () => {
      try {
        for (let step = 0; step < selectedIndexes.length; step++) {
          const i = selectedIndexes[step];
          const next = selectedIndexes[step + 1] ?? frames.length;
          let delay = 0;
          for (let d = i; d < next; d++) {
            delay += frames[d].delay;
          }

          onProgress({
            stage: `Processing frame ${step + 1}/${selectedIndexes.length}`,
            progress: (step / selectedIndexes.length) * 0.5,
          });

          frameCtx.clearRect(0, 0, sourceWidth, sourceHeight);
          frameCtx.putImageData(frames[i].imageData, 0, 0);

          const time = i * 0.1;
          const timeline = frames.length <= 1 ? 0 : i / (frames.length - 1);
          const layers = resolveLayersAtTime(textLayers, timeline);
          const crtCanvas = renderer.renderFrame(frameCanvas, settings, time, {
            preserveAlpha: true,
          });
          drawTextLayers(crtCanvas, layers, settings, crtAffectText, null, timeline);
          let output: HTMLCanvasElement = crtCanvas;
          if (settings.showBezel) output = applyBezelChrome(output);

          encodeCtx.clearRect(0, 0, width, height);
          encodeCtx.imageSmoothingEnabled = true;
          encodeCtx.imageSmoothingQuality = 'high';
          encodeCtx.drawImage(output, 0, 0, width, height);

          if (usesTransparency) {
            const imageData = encodeCtx.getImageData(0, 0, width, height);
            applyTransparencyKey(imageData);
            encodeCtx.putImageData(imageData, 0, 0);
          }

          // GIFEncoder forces dispose=2 whenever a transparent color is set,
          // which is what keeps previous frames from bleeding through.
          gif.addFrame(encodeCanvas, { copy: true, delay });
        }
        gif.render();
      } catch (err) {
        renderer.destroy();
        reject(err);
      }
    })();
  });
}

export function framesToCanvases(frames: GifFrame[]): HTMLCanvasElement[] {
  return frames.map((f) => imageDataToCanvas(f.imageData));
}
