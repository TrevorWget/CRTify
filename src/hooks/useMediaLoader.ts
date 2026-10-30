import { useCallback, useRef, useState } from 'react';
import type { GifFrame, LoadedMedia } from '../types/crt';
import { isPlayableMedia } from '../utils/animationMedia';
import {
  assertFrameBudget,
  checkDimensions,
  loadMediaFile,
  MAX_GIF_FRAMES,
  revokeMedia,
} from '../utils/mediaLoader';
import { loadImageElement } from '../utils/textCompositor';

const BATCH_FRAME_DELAY = 200;

async function decodeBatchFrames(files: File[]): Promise<LoadedMedia> {
  if (files.length > MAX_GIF_FRAMES) {
    throw new Error(`Batch has ${files.length} images. Maximum supported is ${MAX_GIF_FRAMES}.`);
  }

  const images: HTMLImageElement[] = [];
  let width = 0;
  let height = 0;
  for (const file of files) {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImageElement(url);
      checkDimensions(image.width, image.height);
      width = Math.max(width, image.width);
      height = Math.max(height, image.height);
      images.push(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (images.length === 0) throw new Error('No valid images in batch');
  assertFrameBudget(width, height, images.length, 'Batch');

  // Letterbox every still onto a shared canvas so frame-sequence exports stay stable.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to create canvas context');

  const frames: GifFrame[] = images.map((image) => {
    if (image.width === width && image.height === height) {
      ctx.clearRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
    }
    const scale = Math.min(width / image.width, height / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
    return { imageData: ctx.getImageData(0, 0, width, height), delay: BATCH_FRAME_DELAY };
  });

  return {
    type: 'gif',
    width,
    height,
    gifFrames: frames,
    fileName: `batch-${frames.length}-frames`,
  };
}

export function useMediaLoader() {
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gifFrameIndex, setGifFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRef = useRef<LoadedMedia | null>(null);
  const loadTokenRef = useRef(0);

  /** Load media, keeping only the most recent request if several overlap. */
  const runLoad = useCallback(async (load: () => Promise<LoadedMedia>, fallbackError: string) => {
    const token = ++loadTokenRef.current;
    setLoading(true);
    setError(null);

    try {
      const loaded = await load();
      if (token !== loadTokenRef.current) {
        revokeMedia(loaded);
        return;
      }
      setIsPlaying(false);
      setGifFrameIndex(0);
      revokeMedia(mediaRef.current);
      mediaRef.current = loaded;
      setMedia(loaded);
      if (isPlayableMedia(loaded)) setIsPlaying(true);
    } catch (err) {
      if (token !== loadTokenRef.current) return;
      setError(err instanceof Error ? err.message : fallbackError);
    } finally {
      if (token === loadTokenRef.current) setLoading(false);
    }
  }, []);

  const loadFile = useCallback(
    (file: File) => runLoad(() => loadMediaFile(file), 'Failed to load file'),
    [runLoad],
  );

  const loadBatchFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      await runLoad(() => decodeBatchFrames(files), 'Failed to load batch');
    },
    [runLoad],
  );

  const clearMedia = useCallback(() => {
    loadTokenRef.current++;
    revokeMedia(mediaRef.current);
    mediaRef.current = null;
    setMedia(null);
    setGifFrameIndex(0);
    setIsPlaying(false);
    setLoading(false);
    setError(null);
  }, []);

  const captureWebcam = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Webcam capture is not supported in this browser');
      return;
    }
    setLoading(true);
    setError(null);
    let stream: MediaStream | null = null;
    let file: File | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) resolve();
        else video.onloadeddata = () => resolve();
      });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to capture webcam frame');
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('Failed to encode webcam frame');
      file = new File([blob], 'webcam-capture.png', { type: 'image/png' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Webcam capture failed');
      setLoading(false);
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
    if (file) await loadFile(file);
  }, [loadFile]);

  return {
    media,
    loading,
    error,
    gifFrameIndex,
    setGifFrameIndex,
    isPlaying,
    setIsPlaying,
    loadFile,
    loadBatchFiles,
    captureWebcam,
    clearMedia,
    clearError: () => setError(null),
  };
}
