import type { CrtSettings, GifFrame, TextLayer } from '../types/crt';
import { applyBezelChrome } from './bezelOverlay';
import { selectFrameIndexes as selectRangedFrameIndexes } from './exportRange';
import { drawTextLayers } from './textCompositor';
import type { CrtRenderer } from './webgl';

/** Run the CRT pass, composite text layers and add the bezel for one export frame. */
export function composeExportFrame(
  renderer: CrtRenderer,
  source: TexImageSource,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  time: number,
  timeline: number,
  preserveAlpha: boolean,
): HTMLCanvasElement {
  const crtCanvas = renderer.renderFrame(source, settings, time, { preserveAlpha });
  drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null, timeline);
  return settings.showBezel ? applyBezelChrome(crtCanvas) : crtCanvas;
}

const scratchCanvas = document.createElement('canvas');
const scratchCtx = scratchCanvas.getContext('2d');

/** Copy finished pixels onto a reused canvas so they can be scaled with drawImage. */
export function imageDataToScratchCanvas(imageData: ImageData): HTMLCanvasElement {
  if (scratchCanvas.width !== imageData.width || scratchCanvas.height !== imageData.height) {
    scratchCanvas.width = imageData.width;
    scratchCanvas.height = imageData.height;
  }
  scratchCtx?.putImageData(imageData, 0, 0);
  return scratchCanvas;
}

/** Indexes kept inside the in/out range; the range's last frame is always kept. */
export function selectFrameIndexes(
  frameCount: number,
  frameSkip: number,
  rangeStart = 0,
  rangeEnd = 1,
): number[] {
  return selectRangedFrameIndexes(frameCount, frameSkip, rangeStart, rangeEnd);
}

/** Combined delay of a kept frame and the skipped frames that follow it, stopping at the range end. */
export function spanDelay(frames: GifFrame[], selected: number[], step: number): number {
  const next = selected[step + 1] ?? Math.min(frames.length, selected[step] + 1);
  let delay = 0;
  for (let d = selected[step]; d < next; d++) delay += frames[d].delay;
  return delay;
}

export function sourceHasTransparency(frames: GifFrame[]): boolean {
  for (const frame of frames) {
    const data = frame.imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  }
  return false;
}

export function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Frame encode failed'));
          return;
        }
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      'image/jpeg',
      quality,
    );
  });
}

let lastYield = 0;

/** Give the browser a chance to paint progress during long synchronous export loops. */
export async function yieldToBrowser(budgetMs = 30) {
  if (performance.now() - lastYield < budgetMs) return;
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  lastYield = performance.now();
}

export function seekVideo(video: HTMLVideoElement, time: number, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Video seek failed'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out seeking video to ${time.toFixed(2)}s`));
    }, timeoutMs);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

/**
 * Exports drive the same <video> element as the preview; snapshot its playback
 * state so the preview resumes where the user left it.
 */
export function captureVideoState(video: HTMLVideoElement): () => void {
  const { currentTime, loop, muted } = video;
  return () => {
    video.pause();
    video.loop = loop;
    video.muted = muted;
    video.currentTime = currentTime;
  };
}
