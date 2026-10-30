import GIF from 'gif.js';
import type { CrtSettings, ExportProgress, GifFrame, TextLayer } from '../types/crt';
import { frameSequenceTime } from './animationMedia';
import {
  composeExportFrame,
  imageDataToScratchCanvas,
  selectFrameIndexes,
  sourceHasTransparency,
  spanDelay,
  yieldToBrowser,
} from './exportShared';
import { percentToScale } from './imageExport';
import { CrtRenderer } from './webgl';

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
  /** Frames already have the CRT pass, text and bezel baked in. */
  preRendered?: boolean;
  rangeStart?: number;
  rangeEnd?: number;
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
  const preRendered = Boolean(exportSettings.preRendered);
  const scale = percentToScale(exportSettings.scalePercent);
  const quality = Math.min(30, Math.max(1, Math.round(exportSettings.gifQuality)));
  const selectedIndexes = selectFrameIndexes(
    frames.length,
    exportSettings.frameSkip,
    exportSettings.rangeStart,
    exportSettings.rangeEnd,
  );
  const usesTransparency =
    (!preRendered && settings.curvature > 0) || sourceHasTransparency(frames);

  const renderer = preRendered ? null : new CrtRenderer();
  const finishedFrame = (index: number) =>
    renderer
      ? composeExportFrame(
          renderer,
          frames[index].imageData,
          settings,
          textLayers,
          crtAffectText,
          frameSequenceTime(index),
          frames.length <= 1 ? 0 : index / (frames.length - 1),
          true,
        )
      : imageDataToScratchCanvas(frames[index].imageData);

  try {
    // The bezel enlarges frames, so size the GIF from the first finished frame.
    const first = finishedFrame(0);
    const width = Math.max(1, Math.round(first.width * scale));
    const height = Math.max(1, Math.round(first.height * scale));
    encodeCanvas.width = width;
    encodeCanvas.height = height;

    const gif = new GIF({
      workers: Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 2) - 1)),
      quality,
      width,
      height,
      dither: exportSettings.dither ? 'FloydSteinberg' : false,
      // gif.js expects a numeric RGB value at runtime; its community typings
      // incorrectly declare this option as a string.
      transparent: usesTransparency ? (GIF_TRANSPARENT_COLOR as unknown as string) : null,
      workerScript: `${import.meta.env.BASE_URL}gif.worker.js`,
    });

    for (let step = 0; step < selectedIndexes.length; step++) {
      const i = selectedIndexes[step];
      onProgress({
        stage: `Processing frame ${step + 1}/${selectedIndexes.length}`,
        progress: (step / selectedIndexes.length) * 0.5,
      });

      const output = step === 0 ? first : finishedFrame(i);
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
      gif.addFrame(encodeCanvas, { copy: true, delay: spanDelay(frames, selectedIndexes, step) });
      await yieldToBrowser();
    }

    return await new Promise<Blob>((resolve, reject) => {
      gif.on('finished', (blob: Blob) => resolve(blob));
      gif.on('abort', () => reject(new Error('GIF encoding was aborted')));
      gif.on('progress', (p: number) => {
        onProgress({ stage: 'Encoding GIF', progress: 0.5 + p * 0.5 });
      });
      gif.render();
    });
  } finally {
    renderer?.destroy();
  }
}
