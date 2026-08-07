import type { CrtSettings, ExportProgress, TextLayer } from '../types/crt';
import { applyBezelChrome } from './bezelOverlay';
import { getFFmpeg } from './ffmpegShared';
import { getVideoBitrate, getVideoCrf, percentToScale } from './imageExport';
import { resolveLayersAtTime } from './keyframes';
import { MAX_VIDEO_EXPORT_FRAMES } from './mediaLoader';
import { drawTextLayers } from './textCompositor';
import { CrtRenderer } from './webgl';

export interface VideoExportSettings {
  scalePercent: number;
  frameSkip: number;
  optimizeVideo: boolean;
  keepAudio?: boolean;
  sourceFile?: File;
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
  const renderer = new CrtRenderer();
  const scale = percentToScale(exportSettings.scalePercent);
  const width = Math.max(2, Math.round(video.videoWidth * scale) & ~1);
  const height = Math.max(2, Math.round(video.videoHeight * scale) & ~1);
  const duration = video.duration;
  const baseFps = exportSettings.optimizeVideo ? 24 : 30;
  const frameSkip = Math.max(1, Math.round(exportSettings.frameSkip));
  const fps = Math.max(1, baseFps / frameSkip);
  const totalFrames = Math.min(Math.ceil(duration * fps), MAX_VIDEO_EXPORT_FRAMES);
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = width;
  scaledCanvas.height = height;
  const scaledCtx = scaledCanvas.getContext('2d')!;

  onProgress({ stage: 'Loading ffmpeg', progress: 0 });

  const ffmpeg = await getFFmpeg();
  const ext = format === 'mp4' ? 'mp4' : 'webm';
  const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';
  const crf = getVideoCrf(exportSettings.optimizeVideo);
  const keepAudio = Boolean(exportSettings.keepAudio && exportSettings.sourceFile);

  video.currentTime = 0;
  await video.play();
  video.pause();

  try {
    for (let i = 0; i < totalFrames; i++) {
      const time = i / fps;
      if (time > duration) break;

      onProgress({
        stage: `Processing frame ${i + 1}/${totalFrames}`,
        progress: (i / totalFrames) * 0.7,
      });

      await seekVideo(video, time);
      const timeline = duration > 0 ? time / duration : 0;
      const layers = resolveLayersAtTime(textLayers, timeline);
      const crtCanvas = renderer.renderFrame(video, settings, time);
      drawTextLayers(crtCanvas, layers, settings, crtAffectText, null, timeline);
      let output: HTMLCanvasElement = crtCanvas;
      if (settings.showBezel) output = applyBezelChrome(output);
      scaledCtx.fillStyle = '#000';
      scaledCtx.fillRect(0, 0, width, height);
      scaledCtx.drawImage(output, 0, 0, width, height);

      const blob = await canvasToBlob(scaledCanvas, 'image/jpeg');
      const data = new Uint8Array(await blob.arrayBuffer());
      await ffmpeg.writeFile(`frame${String(i).padStart(5, '0')}.jpg`, data);
    }

    onProgress({ stage: 'Encoding video', progress: 0.75 });

    if (keepAudio && exportSettings.sourceFile) {
      const sourceBytes = new Uint8Array(await exportSettings.sourceFile.arrayBuffer());
      const sourceName = `source${exportSettings.sourceFile.name.endsWith('.webm') ? '.webm' : '.mp4'}`;
      await ffmpeg.writeFile(sourceName, sourceBytes);
      if (format === 'mp4') {
        await ffmpeg.exec([
          '-framerate', String(fps),
          '-i', 'frame%05d.jpg',
          '-i', sourceName,
          '-map', '0:v:0',
          '-map', '1:a:0?',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-shortest',
          '-crf', String(crf),
          '-preset', exportSettings.optimizeVideo ? 'veryfast' : 'medium',
          '-y', 'output.mp4',
        ]);
      } else {
        await ffmpeg.exec([
          '-framerate', String(fps),
          '-i', 'frame%05d.jpg',
          '-i', sourceName,
          '-map', '0:v:0',
          '-map', '1:a:0?',
          '-c:v', 'libvpx-vp9',
          '-b:v', '0',
          '-c:a', 'libopus',
          '-shortest',
          '-crf', String(crf),
          '-y', 'output.webm',
        ]);
      }
      await ffmpeg.deleteFile(sourceName);
    } else if (format === 'mp4') {
      await ffmpeg.exec([
        '-framerate', String(fps),
        '-i', 'frame%05d.jpg',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', String(crf),
        '-preset', exportSettings.optimizeVideo ? 'veryfast' : 'medium',
        '-y', 'output.mp4',
      ]);
    } else {
      await ffmpeg.exec([
        '-framerate', String(fps),
        '-i', 'frame%05d.jpg',
        '-c:v', 'libvpx-vp9',
        '-b:v', '0',
        '-crf', String(crf),
        '-y', 'output.webm',
      ]);
    }

    onProgress({ stage: 'Finalizing', progress: 0.95 });

    const outputData = await ffmpeg.readFile(`output.${ext}`);
    const bytes =
      outputData instanceof Uint8Array
        ? new Uint8Array(outputData)
        : new TextEncoder().encode(outputData);
    const outputBlob = new Blob([bytes], { type: mimeType });

    for (let i = 0; i < totalFrames; i++) {
      await ffmpeg.deleteFile(`frame${String(i).padStart(5, '0')}.jpg`);
    }
    await ffmpeg.deleteFile(`output.${ext}`);

    return outputBlob;
  } finally {
    renderer.destroy();
    video.pause();
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      type,
      0.92,
    );
  });
}

export async function exportVideoViaMediaRecorder(
  video: HTMLVideoElement,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  onProgress: (progress: ExportProgress) => void,
  exportSettings: VideoExportSettings,
): Promise<Blob> {
  const renderer = new CrtRenderer();
  const scale = percentToScale(exportSettings.scalePercent);
  const width = Math.max(2, Math.round(video.videoWidth * scale) & ~1);
  const height = Math.max(2, Math.round(video.videoHeight * scale) & ~1);
  const fps = Math.max(1, (exportSettings.optimizeVideo ? 24 : 30) / Math.max(1, exportSettings.frameSkip));

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;

  const stream = outputCanvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: getVideoBitrate(exportSettings.optimizeVideo, exportSettings.scalePercent),
  });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  video.currentTime = 0;
  await video.play();

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      renderer.destroy();
      video.pause();
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = () => {
      renderer.destroy();
      reject(new Error('MediaRecorder failed'));
    };

    recorder.start();
    let startTime: number | null = null;

    const renderLoop = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      onProgress({
        stage: `Recording ${elapsed.toFixed(1)}s / ${video.duration.toFixed(1)}s`,
        progress: Math.min(elapsed / video.duration, 0.99),
      });

      if (video.ended || elapsed >= video.duration) {
        recorder.stop();
        return;
      }

      const timeline = video.duration > 0 ? elapsed / video.duration : 0;
      const layers = resolveLayersAtTime(textLayers, timeline);
      const crtCanvas = renderer.renderFrame(video, settings, elapsed);
      drawTextLayers(crtCanvas, layers, settings, crtAffectText, null, timeline);
      let output: HTMLCanvasElement = crtCanvas;
      if (settings.showBezel) output = applyBezelChrome(output);
      const ctx = outputCanvas.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(output, 0, 0, width, height);
      requestAnimationFrame(renderLoop);
    };

    requestAnimationFrame(renderLoop);
  });
}
