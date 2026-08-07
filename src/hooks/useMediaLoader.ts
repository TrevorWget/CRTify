import { useCallback, useRef, useState } from 'react';
import type { LoadedMedia } from '../types/crt';
import { isPlayableMedia } from '../utils/animationMedia';
import { loadMediaFile, revokeMedia } from '../utils/mediaLoader';

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

  return {
    media,
    loading,
    error,
    gifFrameIndex,
    setGifFrameIndex,
    isPlaying,
    setIsPlaying,
    loadFile,
    clearMedia,
    clearError: () => setError(null),
  };
}
