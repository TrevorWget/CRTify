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
  if (bytes.length < 21) return false;
  const fourcc = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (fourcc(0) !== 'RIFF' || fourcc(8) !== 'WEBP') return false;
  // Animated files must use the extended (VP8X) header with the animation flag set.
  return fourcc(12) === 'VP8X' && (bytes[20] & 0x02) !== 0;
}

/** Browsers play GIF delays of 10ms or less at 100ms; match them so previews and exports agree. */
function normalizeGifDelay(delay: number | undefined): number {
  return !delay || delay <= 10 ? 100 : delay;
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

export function assertFrameBudget(width: number, height: number, frameCount: number, label: string) {
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
  checkDimensions(gif.lsd.width, gif.lsd.height);
  assertFrameBudget(gif.lsd.width, gif.lsd.height, gif.frames.length, 'GIF');

  const frames = decompressFrames(gif, true);

  const canvas = document.createElement('canvas');
  canvas.width = gif.lsd.width;
  canvas.height = gif.lsd.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d');
  if (!ctx || !patchCtx) throw new Error('Failed to create canvas context');

  const result: GifFrame[] = [];

  for (const frame of frames) {
    const { left, top, width, height } = frame.dims;
    // Disposal 3 restores the canvas to how it looked before this frame was drawn.
    const restoreTo =
      frame.disposalType === 3 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;

    if (patchCanvas.width !== width || patchCanvas.height !== height) {
      patchCanvas.width = width;
      patchCanvas.height = height;
    }
    patchCtx.putImageData(new ImageData(new Uint8ClampedArray(frame.patch), width, height), 0, 0);
    ctx.drawImage(patchCanvas, left, top);

    result.push({
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      delay: normalizeGifDelay(frame.delay),
    });

    if (frame.disposalType === 2) {
      ctx.clearRect(left, top, width, height);
    } else if (restoreTo) {
      ctx.putImageData(restoreTo, 0, 0);
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
        checkDimensions(width, height);
        assertFrameBudget(width, height, track.frameCount, 'WebP');
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      // VideoFrame.duration is in microseconds.
      const delayMs = Math.max(10, Math.round((image.duration ?? 100_000) / 1000));
      result.push({
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
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
  checkDimensions(width, height);
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

export function checkDimensions(width: number, height: number) {
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`Maximum resolution is ${MAX_DIMENSION}×${MAX_DIMENSION}.`);
  }
}

export async function loadMediaFile(file: File): Promise<LoadedMedia> {
  const type = detectMediaType(file);
  if (!type) throw new Error('Unsupported file type. Use images, GIFs, WebP, or videos.');

  const objectUrl = URL.createObjectURL(file);
  try {
    return await loadMediaFromUrl(file, type, objectUrl);
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

async function loadMediaFromUrl(
  file: File,
  type: NonNullable<ReturnType<typeof detectMediaType>>,
  objectUrl: string,
): Promise<LoadedMedia> {
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
  try {
    checkDimensions(video.videoWidth, video.videoHeight);
  } catch (err) {
    releaseVideo(video);
    throw err;
  }
  return {
    type,
    width: video.videoWidth,
    height: video.videoHeight,
    video,
    objectUrl,
    ...meta,
  };
}

function releaseVideo(video: HTMLVideoElement) {
  video.onerror = null;
  video.pause();
  video.removeAttribute('src');
  video.load();
}

export function revokeMedia(media: LoadedMedia | null) {
  if (media?.video) releaseVideo(media.video);
  if (media?.objectUrl) URL.revokeObjectURL(media.objectUrl);
}
