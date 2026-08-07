import { decompressFrames, parseGIF } from 'gifuct-js';
import { decodeAnimation } from 'wasm-webp';
import type { GifFrame, LoadedMedia, MediaType } from '../types/crt';

export const MAX_GIF_FRAMES = 1200;
export const MAX_GIF_DECODE_BYTES = 1024 * 1024 * 1024;
/** Soft ceiling for a single edge; browser WebGL/canvas memory is the real limit. */
export const MAX_DIMENSION = 4096;
/** Soft ceiling for ffmpeg.wasm / MediaRecorder exports (~3 min at 30fps). */
export const MAX_VIDEO_EXPORT_FRAMES = 5400;

function detectMediaType(file: File): MediaType | 'webp-candidate' {
  if (file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')) {
    return 'webp-candidate';
  }
  if (file.type.startsWith('image/gif')) return 'gif';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'gif') return 'gif';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext ?? '')) return 'video';
  if (['png', 'jpg', 'jpeg', 'bmp'].includes(ext ?? '')) return 'image';
  return null;
}

function isAnimatedWebPBuffer(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 16) return false;
  const header = String.fromCharCode(...bytes.subarray(0, 4));
  const fourcc = String.fromCharCode(...bytes.subarray(8, 12));
  if (header !== 'RIFF' || fourcc !== 'WEBP') return false;

  // ANIM chunk marks an animated WebP container.
  for (let i = 12; i < bytes.length - 3; i++) {
    if (
      bytes[i] === 0x41 &&
      bytes[i + 1] === 0x4e &&
      bytes[i + 2] === 0x49 &&
      bytes[i + 3] === 0x4d
    ) {
      return true;
    }
  }
  return false;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = url;
    video.load();
  });
}

function assertFrameBudget(width: number, height: number, frameCount: number, label: string) {
  if (frameCount > MAX_GIF_FRAMES) {
    throw new Error(`${label} has ${frameCount} frames. Maximum supported is ${MAX_GIF_FRAMES}.`);
  }

  const estimatedDecodeBytes = width * height * 4 * frameCount;
  if (estimatedDecodeBytes > MAX_GIF_DECODE_BYTES) {
    const estimatedMegabytes = Math.ceil(estimatedDecodeBytes / 1024 / 1024);
    throw new Error(
      `This ${label} needs about ${estimatedMegabytes} MB to decode. Reduce its resolution or frame count.`,
    );
  }
}

async function decodeGif(buffer: ArrayBuffer): Promise<GifFrame[]> {
  const gif = parseGIF(buffer);
  assertFrameBudget(gif.lsd.width, gif.lsd.height, gif.frames.length, 'GIF');

  const frames = decompressFrames(gif, true);

  const canvas = document.createElement('canvas');
  canvas.width = gif.lsd.width;
  canvas.height = gif.lsd.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  const result: GifFrame[] = [];

  for (const frame of frames) {
    const imageData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      frame.dims.width,
      frame.dims.height,
    );
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frame.dims.width;
    tempCanvas.height = frame.dims.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);

    const fullFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    result.push({
      imageData: new ImageData(
        new Uint8ClampedArray(fullFrame.data),
        fullFrame.width,
        fullFrame.height,
      ),
      delay: frame.delay ?? 100,
    });

    if (frame.disposalType === 2) {
      ctx.clearRect(
        frame.dims.left,
        frame.dims.top,
        frame.dims.width,
        frame.dims.height,
      );
    } else if (frame.disposalType === 3) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  return result;
}

async function decodeAnimatedWebPWithImageDecoder(buffer: ArrayBuffer): Promise<GifFrame[] | null> {
  if (typeof ImageDecoder === 'undefined') return null;

  const decoder = new ImageDecoder({ data: buffer, type: 'image/webp' });
  try {
    await decoder.tracks.ready;
    await decoder.completed;
    const track = decoder.tracks.selectedTrack;
    if (!track || track.frameCount <= 1) return null;

    if (track.frameCount > MAX_GIF_FRAMES) {
      throw new Error(
        `WebP has ${track.frameCount} frames. Maximum supported is ${MAX_GIF_FRAMES}.`,
      );
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create canvas context');

    const result: GifFrame[] = [];
    for (let i = 0; i < track.frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      const width = image.displayWidth;
      const height = image.displayHeight;
      if (i === 0) {
        assertFrameBudget(width, height, track.frameCount, 'WebP');
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      const fullFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // VideoFrame.duration is in microseconds.
      const delayMs = Math.max(10, Math.round((image.duration ?? 100_000) / 1000));
      result.push({
        imageData: new ImageData(
          new Uint8ClampedArray(fullFrame.data),
          fullFrame.width,
          fullFrame.height,
        ),
        delay: delayMs,
      });
      image.close();
    }

    return result;
  } finally {
    decoder.close();
  }
}

async function decodeAnimatedWebPWithWasm(buffer: ArrayBuffer): Promise<GifFrame[]> {
  const frames = await decodeAnimation(new Uint8Array(buffer), true);
  if (!frames || frames.length === 0) {
    throw new Error('Failed to decode animated WebP');
  }

  const width = frames[0].width;
  const height = frames[0].height;
  assertFrameBudget(width, height, frames.length, 'WebP');

  return frames.map((frame) => ({
    imageData: new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height),
    delay: Math.max(10, Math.round(frame.duration || 100)),
  }));
}

async function decodeAnimatedWebP(buffer: ArrayBuffer): Promise<GifFrame[]> {
  try {
    const nativeFrames = await decodeAnimatedWebPWithImageDecoder(buffer);
    if (nativeFrames && nativeFrames.length > 1) return nativeFrames;
  } catch {
    // Fall through to wasm decoder.
  }
  return decodeAnimatedWebPWithWasm(buffer);
}

function checkDimensions(width: number, height: number) {
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`Maximum resolution is ${MAX_DIMENSION}×${MAX_DIMENSION}.`);
  }
}

export async function loadMediaFile(file: File): Promise<LoadedMedia> {
  const type = detectMediaType(file);
  if (!type) throw new Error('Unsupported file type. Use images, GIFs, WebP, or videos.');

  const objectUrl = URL.createObjectURL(file);
  const meta = { sourceFile: file, fileName: file.name };

  if (type === 'webp-candidate') {
    const buffer = await file.arrayBuffer();
    if (isAnimatedWebPBuffer(buffer)) {
      const gifFrames = await decodeAnimatedWebP(buffer);
      const width = gifFrames[0]?.imageData.width ?? 0;
      const height = gifFrames[0]?.imageData.height ?? 0;
      checkDimensions(width, height);
      return { type: 'webp', width, height, gifFrames, objectUrl, ...meta };
    }

    const image = await loadImage(objectUrl);
    checkDimensions(image.width, image.height);
    return { type: 'image', width: image.width, height: image.height, image, objectUrl, ...meta };
  }

  if (type === 'image') {
    const image = await loadImage(objectUrl);
    checkDimensions(image.width, image.height);
    return { type, width: image.width, height: image.height, image, objectUrl, ...meta };
  }

  if (type === 'gif') {
    const buffer = await file.arrayBuffer();
    const gifFrames = await decodeGif(buffer);
    const width = gifFrames[0]?.imageData.width ?? 0;
    const height = gifFrames[0]?.imageData.height ?? 0;
    checkDimensions(width, height);
    return { type, width, height, gifFrames, objectUrl, ...meta };
  }

  const video = await loadVideo(objectUrl);
  checkDimensions(video.videoWidth, video.videoHeight);
  return {
    type,
    width: video.videoWidth,
    height: video.videoHeight,
    video,
    objectUrl,
    ...meta,
  };
}

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function revokeMedia(media: LoadedMedia | null) {
  if (media?.objectUrl) {
    URL.revokeObjectURL(media.objectUrl);
  }
  if (media?.video) {
    media.video.pause();
    media.video.src = '';
  }
}
