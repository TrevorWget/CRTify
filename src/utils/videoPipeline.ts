import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { CrtSettings, ExportProgress, TextLayer } from '../types/crt';
import { CrtRenderer } from './webgl';
import { drawTextLayers } from './textCompositor';

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function exportVideo(
  video: HTMLVideoElement,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  format: 'mp4' | 'webm',
  onProgress: (progress: ExportProgress) => void,
): Promise<Blob> {
  const renderer = new CrtRenderer();
  const width = video.videoWidth;
  const height = video.videoHeight;
  const duration = video.duration;
  const fps = 30;
  const totalFrames = Math.min(Math.ceil(duration * fps), 900);

  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = width;
  captureCanvas.height = height;

  onProgress({ stage: 'Loading ffmpeg', progress: 0 });

  const ffmpeg = await getFFmpeg();
  const ext = format === 'mp4' ? 'mp4' : 'webm';
  const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';

  video.currentTime = 0;
  await video.play();
  video.pause();

  try {
    for (let i = 0; i < totalFrames; i++) {
      const time = (i / fps);
      if (time > duration) break;

      onProgress({
        stage: `Processing frame ${i + 1}/${totalFrames}`,
        progress: (i / totalFrames) * 0.7,
      });

      await seekVideo(video, time);
      const crtCanvas = renderer.renderFrame(video, settings, time);
      drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null);

      const blob = await canvasToBlob(crtCanvas, 'image/png');
      const data = new Uint8Array(await blob.arrayBuffer());
      await ffmpeg.writeFile(`frame${String(i).padStart(5, '0')}.png`, data);
    }

    onProgress({ stage: 'Encoding video', progress: 0.75 });

    if (format === 'mp4') {
      await ffmpeg.exec([
        '-framerate', String(fps),
        '-i', 'frame%05d.png',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y', 'output.mp4',
      ]);
    } else {
      await ffmpeg.exec([
        '-framerate', String(fps),
        '-i', 'frame%05d.png',
        '-c:v', 'libvpx-vp9',
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
      await ffmpeg.deleteFile(`frame${String(i).padStart(5, '0')}.png`);
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
    );
  });
}

export async function exportVideoViaMediaRecorder(
  video: HTMLVideoElement,
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  onProgress: (progress: ExportProgress) => void,
): Promise<Blob> {
  const renderer = new CrtRenderer();
  const width = video.videoWidth;
  const height = video.videoHeight;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;

  const stream = outputCanvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
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

      const crtCanvas = renderer.renderFrame(video, settings, elapsed);
      drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null);
      const ctx = outputCanvas.getContext('2d')!;
      ctx.drawImage(crtCanvas, 0, 0);
      requestAnimationFrame(renderLoop);
    };

    requestAnimationFrame(renderLoop);
  });
}
