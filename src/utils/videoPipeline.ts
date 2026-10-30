import type { CrtSettings, ExportProgress, TextLayer } from '../types/crt';
import {
  canvasToJpegBytes,
  captureVideoState,
  composeExportFrame,
  seekVideo,
} from './exportShared';
import { createFrameSink, encodeFrameSequence, runFfmpegJob } from './ffmpegShared';
import { getVideoBitrate, percentToScale } from './imageExport';
import { MAX_VIDEO_EXPORT_FRAMES } from './mediaLoader';
import { CrtRenderer } from './webgl';

export interface VideoExportSettings {
  scalePercent: number;
  frameSkip: number;
  optimizeVideo: boolean;
  keepAudio?: boolean;
  sourceFile?: File;
}

function evenScaledSize(video: HTMLVideoElement, scalePercent: number) {
  const scale = percentToScale(scalePercent);
  return {
    width: Math.max(2, Math.round(video.videoWidth * scale) & ~1),
    height: Math.max(2, Math.round(video.videoHeight * scale) & ~1),
  };
}

function exportFps(exportSettings: VideoExportSettings) {
  const baseFps = exportSettings.optimizeVideo ? 24 : 30;
  return Math.max(1, baseFps / Math.max(1, Math.round(exportSettings.frameSkip)));
}

export async function exportVideo(
  video: HTMLVideoElement,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  format: 'mp4' | 'webm',
  onProgress: (progress: ExportProgress) => void,
  exportSettings: VideoExportSettings,
): Promise<Blob> {
  const { width, height } = evenScaledSize(video, exportSettings.scalePercent);
  const duration = video.duration;
  const fps = exportFps(exportSettings);
  const totalFrames = Math.min(Math.ceil(duration * fps), MAX_VIDEO_EXPORT_FRAMES);
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = width;
  scaledCanvas.height = height;
  const scaledCtx = scaledCanvas.getContext('2d')!;

  onProgress({ stage: 'Loading ffmpeg', progress: 0 });
  const renderer = new CrtRenderer();
  const restoreVideo = captureVideoState(video);

  try {
    video.muted = true;
    // Some browsers only decode frames for seeking after playback has started once.
    await video.play().catch(() => undefined);
    video.pause();

    return await runFfmpegJob(async (ffmpeg) => {
      const sink = createFrameSink(ffmpeg);
      for (let i = 0; i < totalFrames; i++) {
        const time = i / fps;
        onProgress({
          stage: `Processing frame ${i + 1}/${totalFrames}`,
          progress: (i / totalFrames) * 0.7,
        });

        await seekVideo(video, time);
        const timeline = duration > 0 ? time / duration : 0;
        const output = composeExportFrame(
          renderer, video, settings, textLayers, crtAffectText, time, timeline, false,
        );
        scaledCtx.fillStyle = '#000';
        scaledCtx.fillRect(0, 0, width, height);
        scaledCtx.drawImage(output, 0, 0, width, height);
        await sink.write(await canvasToJpegBytes(scaledCanvas));
      }

      onProgress({ stage: 'Encoding video', progress: 0.75 });
      const blob = await encodeFrameSequence(ffmpeg, {
        format,
        fps,
        optimize: exportSettings.optimizeVideo,
        audioSource: exportSettings.keepAudio ? exportSettings.sourceFile : undefined,
      });
      onProgress({ stage: 'Finalizing', progress: 0.95 });
      return blob;
    });
  } finally {
    renderer.destroy();
    restoreVideo();
  }
}

const RECORDER_MIME_TYPES: Record<'mp4' | 'webm', string[]> = {
  mp4: ['video/mp4;codecs=avc1', 'video/mp4'],
  webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
};

function recorderMimeType(format: 'mp4' | 'webm'): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return RECORDER_MIME_TYPES[format].find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/** Whether the real-time MediaRecorder path can produce this container. */
export function canRecordFormat(format: 'mp4' | 'webm'): boolean {
  return recorderMimeType(format) !== null;
}

/** Real-time fallback when ffmpeg.wasm is unavailable. Does not carry audio. */
export async function exportVideoViaMediaRecorder(
  video: HTMLVideoElement,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  format: 'mp4' | 'webm',
  onProgress: (progress: ExportProgress) => void,
  exportSettings: VideoExportSettings,
): Promise<Blob> {
  const mimeType = recorderMimeType(format);
  if (!mimeType) throw new Error(`This browser cannot record ${format.toUpperCase()} video.`);

  const { width, height } = evenScaledSize(video, exportSettings.scalePercent);
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d')!;
  const stream = outputCanvas.captureStream(exportFps(exportSettings));
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: getVideoBitrate(exportSettings.optimizeVideo, exportSettings.scalePercent),
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const renderer = new CrtRenderer();
  const restoreVideo = captureVideoState(video);
  const duration = video.duration;
  const hasVideoFrameCallback = typeof video.requestVideoFrameCallback === 'function';
  let stopped = false;

  const drawFrame = () => {
    const time = video.currentTime;
    const timeline = duration > 0 ? time / duration : 0;
    onProgress({
      stage: `Recording ${time.toFixed(1)}s / ${duration.toFixed(1)}s`,
      progress: Math.min(timeline, 0.99),
    });
    const output = composeExportFrame(
      renderer, video, settings, textLayers, crtAffectText, time, timeline, false,
    );
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(output, 0, 0, width, height);
  };

  try {
    video.loop = false;
    video.muted = true;
    await seekVideo(video, 0);

    return await new Promise<Blob>((resolve, reject) => {
      const finish = () => {
        if (stopped) return;
        stopped = true;
        if (recorder.state !== 'inactive') recorder.stop();
      };
      const tick = () => {
        if (stopped) return;
        drawFrame();
        if (hasVideoFrameCallback) video.requestVideoFrameCallback(tick);
        else requestAnimationFrame(tick);
      };

      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = () => {
        finish();
        reject(new Error('MediaRecorder failed'));
      };
      video.addEventListener(
        'ended',
        () => {
          if (!stopped) drawFrame();
          finish();
        },
        { once: true },
      );

      recorder.start();
      drawFrame();
      video.play().then(tick, (err: unknown) => {
        finish();
        reject(err instanceof Error ? err : new Error('Video playback failed'));
      });
    });
  } finally {
    stopped = true;
    stream.getTracks().forEach((track) => track.stop());
    renderer.destroy();
    restoreVideo();
  }
}
