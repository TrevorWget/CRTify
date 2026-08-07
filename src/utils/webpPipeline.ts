import { encodeAnimation } from 'wasm-webp';
import type { CrtSettings, ExportProgress, GifFrame, TextLayer } from '../types/crt';
import { applyBezelChrome } from './bezelOverlay';
import { CrtRenderer } from './webgl';
import { drawTextLayers } from './textCompositor';
import { percentToScale } from './imageExport';

const frameCanvas = document.createElement('canvas');
const frameCtx = frameCanvas.getContext('2d')!;
const encodeCanvas = document.createElement('canvas');
const encodeCtx = encodeCanvas.getContext('2d', { willReadFrequently: true })!;

export interface WebpAnimExportSettings {
  scalePercent: number;
  /** 0.5–1 mapped to libwebp quality 50–100. */
  imageQuality: number;
  frameSkip: number;
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

export async function exportAnimatedWebp(
  frames: GifFrame[],
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  onProgress: (progress: ExportProgress) => void,
  exportSettings: WebpAnimExportSettings,
): Promise<Blob> {
  const renderer = new CrtRenderer();
  const sourceWidth = frames[0].imageData.width;
  const sourceHeight = frames[0].imageData.height;
  const scale = percentToScale(exportSettings.scalePercent);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const frameSkip = Math.max(1, Math.round(exportSettings.frameSkip));
  const quality = Math.min(
    100,
    Math.max(50, Math.round(exportSettings.imageQuality * 100)),
  );

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

  try {
    const encodedFrames: { data: Uint8Array; duration: number; config: { lossless: number; quality: number } }[] =
      [];

    for (let step = 0; step < selectedIndexes.length; step++) {
      const i = selectedIndexes[step];
      const next = selectedIndexes[step + 1] ?? frames.length;
      let delay = 0;
      for (let d = i; d < next; d++) {
        delay += frames[d].delay;
      }

      onProgress({
        stage: `Processing frame ${step + 1}/${selectedIndexes.length}`,
        progress: (step / selectedIndexes.length) * 0.7,
      });

      frameCtx.clearRect(0, 0, sourceWidth, sourceHeight);
      frameCtx.putImageData(frames[i].imageData, 0, 0);

      const time = i * 0.1;
      const timeline = frames.length <= 1 ? 0 : i / (frames.length - 1);
      const crtCanvas = renderer.renderFrame(frameCanvas, settings, time, {
        preserveAlpha: true,
      });
      drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null, timeline);
      let output: HTMLCanvasElement = crtCanvas;
      if (settings.showBezel) output = applyBezelChrome(output);

      encodeCtx.clearRect(0, 0, width, height);
      encodeCtx.imageSmoothingEnabled = true;
      encodeCtx.imageSmoothingQuality = 'high';
      encodeCtx.drawImage(output, 0, 0, width, height);

      const imageData = encodeCtx.getImageData(0, 0, width, height);
      encodedFrames.push({
        data: new Uint8Array(imageData.data),
        duration: Math.max(10, Math.round(delay)),
        config: { lossless: 0, quality },
      });
    }

    onProgress({ stage: 'Encoding animated WebP', progress: 0.8 });

    const bytes = await encodeAnimation(width, height, usesTransparency, encodedFrames);
    if (!bytes) throw new Error('Animated WebP encoder returned empty output');

    onProgress({ stage: 'Finalizing', progress: 0.95 });
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: 'image/webp' });
  } finally {
    renderer.destroy();
  }
}
