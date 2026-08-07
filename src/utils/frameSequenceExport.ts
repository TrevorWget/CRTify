import type { CrtSettings, ExportProgress, GifFrame, TextLayer } from '../types/crt';
import { applyBezelChrome } from './bezelOverlay';
import { percentToScale } from './imageExport';
import { normalizeExportRange, selectFrameIndexes } from './exportRange';
import { imageDataToCanvas } from './mediaLoader';
import { drawTextLayers } from './textCompositor';
import { CrtRenderer } from './webgl';
import { getFFmpeg } from './ffmpegShared';

export interface FrameVideoExportSettings {
  scalePercent: number;
  frameSkip: number;
  optimizeVideo: boolean;
  rangeStart?: number;
  rangeEnd?: number;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Frame encode failed'));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      'image/jpeg',
      0.92,
    );
  });
}

/** Encode a GIF/WebP frame sequence to MP4 or WebM via ffmpeg.wasm. */
export async function exportFramesAsVideo(
  frames: GifFrame[],
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  format: 'mp4' | 'webm',
  onProgress: (progress: ExportProgress) => void,
  exportSettings: FrameVideoExportSettings,
): Promise<Blob> {
  const renderer = new CrtRenderer();
  const sourceWidth = frames[0].imageData.width;
  const sourceHeight = frames[0].imageData.height;
  const scale = percentToScale(exportSettings.scalePercent);
  const width = Math.max(2, Math.round(sourceWidth * scale) & ~1);
  const height = Math.max(2, Math.round(sourceHeight * scale) & ~1);
  const frameSkip = Math.max(1, Math.round(exportSettings.frameSkip));
  const selected = selectFrameIndexes(
    frames.length,
    frameSkip,
    exportSettings.rangeStart,
    exportSettings.rangeEnd,
  );
  if (selected.length === 0) selected.push(0);

  let totalDurationMs = 0;
  for (const frame of frames) totalDurationMs += Math.max(10, frame.delay);
  const avgDelay =
    selected.length > 1
      ? Math.max(
          20,
          Math.round(
            selected.reduce((sum, index, step) => {
              const next = selected[step + 1] ?? frames.length;
              let delay = 0;
              for (let d = index; d < next; d++) delay += frames[d].delay;
              return sum + delay;
            }, 0) / selected.length,
          ),
        )
      : 100;
  const fps = Math.max(1, Math.round(1000 / avgDelay));

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = sourceWidth;
  frameCanvas.height = sourceHeight;
  const frameCtx = frameCanvas.getContext('2d')!;
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = width;
  scaledCanvas.height = height;
  const scaledCtx = scaledCanvas.getContext('2d')!;

  onProgress({ stage: 'Loading ffmpeg', progress: 0 });
  const ffmpeg = await getFFmpeg();
  const ext = format === 'mp4' ? 'mp4' : 'webm';
  const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';

  try {
    for (let step = 0; step < selected.length; step++) {
      const index = selected[step];
      onProgress({
        stage: `Processing frame ${step + 1}/${selected.length}`,
        progress: (step / selected.length) * 0.7,
      });

      frameCtx.clearRect(0, 0, sourceWidth, sourceHeight);
      frameCtx.putImageData(frames[index].imageData, 0, 0);
      const timeline = frames.length <= 1 ? 0 : index / (frames.length - 1);
      const crtCanvas = renderer.renderFrame(frameCanvas, settings, index * 0.1, {
        preserveAlpha: false,
      });
      drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null, timeline);
      let output: HTMLCanvasElement = crtCanvas;
      if (settings.showBezel) output = applyBezelChrome(output);
      scaledCtx.fillStyle = '#000';
      scaledCtx.fillRect(0, 0, width, height);
      scaledCtx.drawImage(output, 0, 0, width, height);
      const bytes = await canvasToJpegBytes(scaledCanvas);
      await ffmpeg.writeFile(`frame${String(step).padStart(5, '0')}.jpg`, bytes);
    }

    onProgress({ stage: 'Encoding video', progress: 0.8 });
    if (format === 'mp4') {
      await ffmpeg.exec([
        '-framerate',
        String(fps),
        '-i',
        'frame%05d.jpg',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        exportSettings.optimizeVideo ? '28' : '23',
        '-y',
        'output.mp4',
      ]);
    } else {
      await ffmpeg.exec([
        '-framerate',
        String(fps),
        '-i',
        'frame%05d.jpg',
        '-c:v',
        'libvpx-vp9',
        '-b:v',
        '0',
        '-crf',
        exportSettings.optimizeVideo ? '32' : '28',
        '-y',
        'output.webm',
      ]);
    }

    const outputData = await ffmpeg.readFile(`output.${ext}`);
    const bytes =
      outputData instanceof Uint8Array
        ? new Uint8Array(outputData)
        : new TextEncoder().encode(outputData);

    for (let step = 0; step < selected.length; step++) {
      await ffmpeg.deleteFile(`frame${String(step).padStart(5, '0')}.jpg`);
    }
    await ffmpeg.deleteFile(`output.${ext}`);
    return new Blob([bytes], { type: mimeType });
  } finally {
    renderer.destroy();
  }
}

export async function rasterizeVideoToFrames(
  video: HTMLVideoElement,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  onProgress: (progress: ExportProgress) => void,
  options: {
    scalePercent: number;
    frameSkip: number;
    optimizeVideo: boolean;
    maxFrames?: number;
    rangeStart?: number;
    rangeEnd?: number;
  },
): Promise<GifFrame[]> {
  const renderer = new CrtRenderer();
  const scale = percentToScale(options.scalePercent);
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const baseFps = options.optimizeVideo ? 12 : 15;
  const fps = Math.max(1, baseFps / Math.max(1, options.frameSkip));
  const maxFrames = options.maxFrames ?? 300;
  const duration = video.duration;
  const { start, end } = normalizeExportRange(options.rangeStart, options.rangeEnd);
  const t0 = start * duration;
  const t1 = Math.max(t0, end * duration);
  const span = Math.max(0.001, t1 - t0);
  const totalFrames = Math.min(Math.ceil(span * fps), maxFrames);
  const delay = Math.round(1000 / fps);
  const scaled = document.createElement('canvas');
  scaled.width = width;
  scaled.height = height;
  const ctx = scaled.getContext('2d')!;
  const frames: GifFrame[] = [];

  try {
    for (let i = 0; i < totalFrames; i++) {
      const time = t0 + i / fps;
      if (time > t1 + 1e-4) break;
      onProgress({
        stage: `Sampling video frame ${i + 1}/${totalFrames}`,
        progress: (i / totalFrames) * 0.55,
      });
      await seekVideo(video, Math.min(time, duration));
      const timeline = duration > 0 ? Math.min(time, duration) / duration : 0;
      const crtCanvas = renderer.renderFrame(video, settings, time, { preserveAlpha: true });
      drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null, timeline);
      let output: HTMLCanvasElement = crtCanvas;
      if (settings.showBezel) output = applyBezelChrome(output);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(output, 0, 0, width, height);
      frames.push({
        imageData: new ImageData(
          new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data),
          width,
          height,
        ),
        delay,
      });
    }
    return frames;
  } finally {
    renderer.destroy();
  }
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

export function stillToLoopFrames(
  source: CanvasImageSource,
  width: number,
  height: number,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  frameCount = 16,
): GifFrame[] {
  const renderer = new CrtRenderer();
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = width;
  frameCanvas.height = height;
  const ctx = frameCanvas.getContext('2d')!;
  const frames: GifFrame[] = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      const t = i / frameCount;
      const crtCanvas = renderer.renderFrame(
        source as HTMLCanvasElement,
        settings,
        i * 0.12,
        { preserveAlpha: true },
      );
      drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null, t);
      let output: HTMLCanvasElement = crtCanvas;
      if (settings.showBezel) output = applyBezelChrome(output);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(output, 0, 0, width, height);
      frames.push({
        imageData: new ImageData(
          new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data),
          width,
          height,
        ),
        delay: 80,
      });
    }
    return frames;
  } finally {
    renderer.destroy();
  }
}

export function cloneFrameCanvas(imageData: ImageData): HTMLCanvasElement {
  return imageDataToCanvas(imageData);
}
