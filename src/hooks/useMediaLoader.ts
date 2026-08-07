import { useCallback, useRef, useState } from 'react';
import type { GifFrame, LoadedMedia } from '../types/crt';
import { isPlayableMedia } from '../utils/animationMedia';
import { loadMediaFile, revokeMedia } from '../utils/mediaLoader';
import { loadImageElement } from '../utils/textCompositor';

export function useMediaLoader() {
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gifFrameIndex, setGifFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRef = useRef<LoadedMedia | null>(null);

  const loadFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setGifFrameIndex(0);

    if (mediaRef.current) {
      revokeMedia(mediaRef.current);
    }

    try {
      const loaded = await loadMediaFile(file);
      mediaRef.current = loaded;
      setMedia(loaded);
      if (isPlayableMedia(loaded)) {
        setIsPlaying(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load file';
      setError(message);
      setMedia(null);
      mediaRef.current = null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearMedia = useCallback(() => {
    if (mediaRef.current) {
      revokeMedia(mediaRef.current);
    }
    mediaRef.current = null;
    setMedia(null);
    setGifFrameIndex(0);
    setIsPlaying(false);
    setError(null);
  }, []);

  const loadBatchFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setGifFrameIndex(0);

    if (mediaRef.current) {
      revokeMedia(mediaRef.current);
    }

    try {
      const frames: GifFrame[] = [];
      let width = 0;
      let height = 0;
      for (const file of files) {
        const url = URL.createObjectURL(file);
        try {
          const image = await loadImageElement(url);
          width = Math.max(width, image.width);
          height = Math.max(height, image.height);
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.drawImage(image, 0, 0);
          frames.push({
            imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
            delay: 200,
          });
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      if (frames.length === 0) throw new Error('No valid images in batch');
      // Normalize every still onto a shared canvas so GIF export stays stable.
      const normalized: GifFrame[] = frames.map((frame) => {
        if (frame.imageData.width === width && frame.imageData.height === height) return frame;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        const temp = document.createElement('canvas');
        temp.width = frame.imageData.width;
        temp.height = frame.imageData.height;
        temp.getContext('2d')!.putImageData(frame.imageData, 0, 0);
        const scale = Math.min(width / frame.imageData.width, height / frame.imageData.height);
        const drawW = frame.imageData.width * scale;
        const drawH = frame.imageData.height * scale;
        ctx.drawImage(temp, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
        return {
          imageData: ctx.getImageData(0, 0, width, height),
          delay: frame.delay,
        };
      });
      const loaded: LoadedMedia = {
        type: 'gif',
        width,
        height,
        gifFrames: normalized,
        fileName: `batch-${normalized.length}-frames`,
      };
      mediaRef.current = loaded;
      setMedia(loaded);
      setIsPlaying(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load batch';
      setError(message);
      setMedia(null);
      mediaRef.current = null;
    } finally {
      setLoading(false);
    }
  }, []);

  const captureWebcam = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Webcam capture is not supported in this browser');
      return;
    }
    setLoading(true);
    setError(null);
    let stream: MediaStream | null = null;
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
      await loadFile(new File([blob], 'webcam-capture.png', { type: 'image/png' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webcam capture failed';
      setError(message);
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setLoading(false);
    }
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
