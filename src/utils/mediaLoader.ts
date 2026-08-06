import { decompressFrames, parseGIF } from 'gifuct-js';
import type { GifFrame, LoadedMedia, MediaType } from '../types/crt';

const MAX_GIF_FRAMES = 1200;
const MAX_GIF_DECODE_BYTES = 768 * 1024 * 1024;
const MAX_DIMENSION = 1920;

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith('image/gif')) return 'gif';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'gif') return 'gif';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext ?? '')) return 'video';
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext ?? '')) return 'image';
  return null;
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

async function decodeGif(buffer: ArrayBuffer): Promise<GifFrame[]> {
  const gif = parseGIF(buffer);
  const frameCount = gif.frames.length;
  const estimatedDecodeBytes = gif.lsd.width * gif.lsd.height * 4 * frameCount;

  if (frameCount > MAX_GIF_FRAMES) {
    throw new Error(`GIF has ${frameCount} frames. Maximum supported is ${MAX_GIF_FRAMES}.`);
  }

  if (estimatedDecodeBytes > MAX_GIF_DECODE_BYTES) {
    const estimatedMegabytes = Math.ceil(estimatedDecodeBytes / 1024 / 1024);
    throw new Error(
      `This GIF needs about ${estimatedMegabytes} MB to decode. Reduce its resolution or frame count.`,
    );
  }

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

function checkDimensions(width: number, height: number) {
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`Maximum resolution is ${MAX_DIMENSION}x${MAX_DIMENSION}.`);
  }
}

export async function loadMediaFile(file: File): Promise<LoadedMedia> {
  const type = detectMediaType(file);
  if (!type) throw new Error('Unsupported file type. Use images, GIFs, or videos.');

  const objectUrl = URL.createObjectURL(file);

  if (type === 'image') {
    const image = await loadImage(objectUrl);
    checkDimensions(image.width, image.height);
    return { type, width: image.width, height: image.height, image, objectUrl };
  }

  if (type === 'gif') {
    const buffer = await file.arrayBuffer();
    const gifFrames = await decodeGif(buffer);
    const width = gifFrames[0]?.imageData.width ?? 0;
    const height = gifFrames[0]?.imageData.height ?? 0;
    checkDimensions(width, height);
    return { type, width, height, gifFrames, objectUrl };
  }

  const video = await loadVideo(objectUrl);
  checkDimensions(video.videoWidth, video.videoHeight);
  return {
    type,
    width: video.videoWidth,
    height: video.videoHeight,
    video,
    objectUrl,
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
