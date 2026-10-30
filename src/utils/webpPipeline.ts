import { encodeAnimation } from 'wasm-webp';
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

export interface WebpAnimExportSettings {
  scalePercent: number;
  /** 0.5–1 mapped to libwebp quality 50–100. */
  imageQuality: number;
  frameSkip: number;
  /** Frames already have the CRT pass, text and bezel baked in. */
  preRendered?: boolean;
}

export async function exportAnimatedWebp(
  frames: GifFrame[],
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  onProgress: (progress: ExportProgress) => void,
  exportSettings: WebpAnimExportSettings,
): Promise<Blob> {
  const preRendered = Boolean(exportSettings.preRendered);
  const scale = percentToScale(exportSettings.scalePercent);
  const quality = Math.min(
    100,
    Math.max(50, Math.round(exportSettings.imageQuality * 100)),
  );
  const selectedIndexes = selectFrameIndexes(frames.length, exportSettings.frameSkip);
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
    const encodedFrames: { data: Uint8Array; duration: number; config: { lossless: number; quality: number } }[] =
      [];
    let width = 0;
    let height = 0;

    for (let step = 0; step < selectedIndexes.length; step++) {
      onProgress({
        stage: `Processing frame ${step + 1}/${selectedIndexes.length}`,
        progress: (step / selectedIndexes.length) * 0.7,
      });

      const output = finishedFrame(selectedIndexes[step]);
      if (step === 0) {
        width = Math.max(1, Math.round(output.width * scale));
        height = Math.max(1, Math.round(output.height * scale));
        encodeCanvas.width = width;
        encodeCanvas.height = height;
      }
      encodeCtx.clearRect(0, 0, width, height);
      encodeCtx.imageSmoothingEnabled = true;
      encodeCtx.imageSmoothingQuality = 'high';
      encodeCtx.drawImage(output, 0, 0, width, height);

      const imageData = encodeCtx.getImageData(0, 0, width, height);
      encodedFrames.push({
        data: new Uint8Array(imageData.data.buffer),
        duration: Math.max(10, Math.round(spanDelay(frames, selectedIndexes, step))),
        config: { lossless: 0, quality },
      });
      await yieldToBrowser();
    }

    onProgress({ stage: 'Encoding animated WebP', progress: 0.8 });

    const bytes = await encodeAnimation(width, height, usesTransparency, encodedFrames);
    if (!bytes) throw new Error('Animated WebP encoder returned empty output');

    onProgress({ stage: 'Finalizing', progress: 0.95 });
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: 'image/webp' });
  } finally {
    renderer?.destroy();
  }
}
