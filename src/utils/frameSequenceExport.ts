import type { CrtSettings, ExportProgress, GifFrame, TextLayer } from '../types/crt';
import { frameSequenceTime } from './animationMedia';
import {
  canvasToJpegBytes,
  captureVideoState,
  composeExportFrame,
  imageDataToScratchCanvas,
  seekVideo,
  selectFrameIndexes,
  spanDelay,
  yieldToBrowser,
} from './exportShared';
import { createFrameSink, encodeFrameSequence, runFfmpegJob } from './ffmpegShared';
import { percentToScale } from './imageExport';
import { CrtRenderer } from './webgl';

export interface FrameVideoExportSettings {
  scalePercent: number;
  frameSkip: number;
  optimizeVideo: boolean;
  /** Frames already have the CRT pass, text and bezel baked in. */
  preRendered?: boolean;
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
  const sourceWidth = frames[0].imageData.width;
  const sourceHeight = frames[0].imageData.height;
  const scale = percentToScale(exportSettings.scalePercent);
  const width = Math.max(2, Math.round(sourceWidth * scale) & ~1);
  const height = Math.max(2, Math.round(sourceHeight * scale) & ~1);
  const selected = selectFrameIndexes(frames.length, exportSettings.frameSkip);

  let totalDelay = 0;
  for (let step = 0; step < selected.length; step++) totalDelay += spanDelay(frames, selected, step);
  const avgDelay = selected.length > 1 ? Math.max(20, Math.round(totalDelay / selected.length)) : 100;
  const fps = Math.max(1, Math.round(1000 / avgDelay));

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = width;
  scaledCanvas.height = height;
  const scaledCtx = scaledCanvas.getContext('2d')!;

  onProgress({ stage: 'Loading ffmpeg', progress: 0 });
  const renderer = exportSettings.preRendered ? null : new CrtRenderer();

  try {
    return await runFfmpegJob(async (ffmpeg) => {
      const sink = createFrameSink(ffmpeg);
      for (let step = 0; step < selected.length; step++) {
        const index = selected[step];
        onProgress({
          stage: `Processing frame ${step + 1}/${selected.length}`,
          progress: (step / selected.length) * 0.7,
        });

        const frame = frames[index].imageData;
        const timeline = frames.length <= 1 ? 0 : index / (frames.length - 1);
        const output = renderer
          ? composeExportFrame(
              renderer, frame, settings, textLayers, crtAffectText,
              frameSequenceTime(index), timeline, false,
            )
          : imageDataToScratchCanvas(frame);
        scaledCtx.fillStyle = '#000';
        scaledCtx.fillRect(0, 0, width, height);
        scaledCtx.drawImage(output, 0, 0, width, height);
        await sink.write(await canvasToJpegBytes(scaledCanvas));
      }

      onProgress({ stage: 'Encoding video', progress: 0.8 });
      const blob = await encodeFrameSequence(ffmpeg, {
        format,
        fps,
        optimize: exportSettings.optimizeVideo,
      });
      onProgress({ stage: 'Finalizing', progress: 0.95 });
      return blob;
    });
  } finally {
    renderer?.destroy();
  }
}

/** Sample a video into finished (CRT + text + bezel) frames for GIF/WebP encoding. */
export async function rasterizeVideoToFrames(
  video: HTMLVideoElement,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  onProgress: (progress: ExportProgress) => void,
  options: { scalePercent: number; frameSkip: number; optimizeVideo: boolean; maxFrames?: number },
): Promise<GifFrame[]> {
  const scale = percentToScale(options.scalePercent);
  const baseFps = options.optimizeVideo ? 12 : 15;
  const fps = Math.max(1, baseFps / Math.max(1, options.frameSkip));
  const maxFrames = options.maxFrames ?? 300;
  const totalFrames = Math.min(Math.ceil(video.duration * fps), maxFrames);
  const delay = Math.round(1000 / fps);
  const scaled = document.createElement('canvas');
  const ctx = scaled.getContext('2d', { willReadFrequently: true })!;
  const frames: GifFrame[] = [];
  const renderer = new CrtRenderer();
  const restoreVideo = captureVideoState(video);

  try {
    for (let i = 0; i < totalFrames; i++) {
      const time = i / fps;
      onProgress({
        stage: `Sampling video frame ${i + 1}/${totalFrames}`,
        progress: (i / totalFrames) * 0.5,
      });
      await seekVideo(video, time);
      const timeline = video.duration > 0 ? time / video.duration : 0;
      const output = composeExportFrame(
        renderer, video, settings, textLayers, crtAffectText, time, timeline, true,
      );
      if (i === 0) {
        scaled.width = Math.max(1, Math.round(output.width * scale));
        scaled.height = Math.max(1, Math.round(output.height * scale));
      }
      ctx.clearRect(0, 0, scaled.width, scaled.height);
      ctx.drawImage(output, 0, 0, scaled.width, scaled.height);
      frames.push({ imageData: ctx.getImageData(0, 0, scaled.width, scaled.height), delay });
    }
    return frames;
  } finally {
    renderer.destroy();
    restoreVideo();
  }
}

/** Render a still into a short loop of finished frames so animated CRT effects show. */
export async function stillToLoopFrames(
  source: TexImageSource,
  width: number,
  height: number,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  frameCount = 16,
): Promise<GifFrame[]> {
  const renderer = new CrtRenderer();
  const frameCanvas = document.createElement('canvas');
  const frames: GifFrame[] = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      const output = composeExportFrame(
        renderer, source, settings, textLayers, crtAffectText, i * 0.12, i / frameCount, true,
      );
      if (i === 0) {
        // The bezel enlarges the frame; keep its real size instead of squashing it.
        frameCanvas.width = settings.showBezel ? output.width : width;
        frameCanvas.height = settings.showBezel ? output.height : height;
      }
      const ctx = frameCanvas.getContext('2d', { willReadFrequently: true })!;
      ctx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
      ctx.drawImage(output, 0, 0, frameCanvas.width, frameCanvas.height);
      frames.push({
        imageData: ctx.getImageData(0, 0, frameCanvas.width, frameCanvas.height),
        delay: 80,
      });
      await yieldToBrowser();
    }
    return frames;
  } finally {
    renderer.destroy();
  }
}
