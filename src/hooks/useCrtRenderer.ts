import { useCallback, useEffect, useRef } from 'react';
import type { CrtSettings, LoadedMedia, TextLayer } from '../types/crt';
import { CrtRenderer } from '../utils/webgl';
import { drawTextLayers } from '../utils/textCompositor';
import {
  getPreviewTime,
  getTimelinePosition,
  isFrameSequenceMedia,
} from '../utils/animationMedia';

interface UseCrtRendererOptions {
  media: LoadedMedia | null;
  settings: CrtSettings;
  textLayers: TextLayer[];
  crtAffectText: boolean;
  selectedLayerId: string | null;
  gifFrameIndex: number;
  isPlaying: boolean;
  /** Advances frame sequences; renderers without it only follow the shared playhead. */
  onGifFrameChange?: (index: number) => void;
  /** Only one renderer per media element should start and stop video playback. */
  controlsPlayback?: boolean;
}

/** GIFs that sit on one frame for longer than this restart timing instead of fast-forwarding. */
const MAX_CATCH_UP_MS = 1000;

export function useCrtRenderer({
  media,
  settings,
  textLayers,
  crtAffectText,
  selectedLayerId,
  gifFrameIndex,
  isPlaying,
  onGifFrameChange,
  controlsPlayback = true,
}: UseCrtRendererOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CrtRenderer | null>(null);
  const frameIndexRef = useRef(gifFrameIndex);

  const render = useCallback(() => {
    const displayCanvas = canvasRef.current;
    if (!media || !displayCanvas) return;

    let source: TexImageSource | null = null;
    if (media.type === 'image' && media.image) {
      source = media.image;
    } else if (isFrameSequenceMedia(media) && media.gifFrames) {
      source = media.gifFrames[gifFrameIndex % media.gifFrames.length].imageData;
    } else if (media.type === 'video' && media.video) {
      if (media.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      source = media.video;
    }
    if (!source) return;

    rendererRef.current ??= new CrtRenderer();
    const crtCanvas = rendererRef.current.renderFrame(
      source,
      settings,
      getPreviewTime(media, gifFrameIndex),
      { preserveAlpha: true },
    );
    if (displayCanvas.width !== crtCanvas.width) displayCanvas.width = crtCanvas.width;
    if (displayCanvas.height !== crtCanvas.height) displayCanvas.height = crtCanvas.height;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    ctx.drawImage(crtCanvas, 0, 0);
    drawTextLayers(
      displayCanvas,
      textLayers,
      settings,
      crtAffectText,
      selectedLayerId,
      getTimelinePosition(media, gifFrameIndex),
    );
  }, [media, settings, textLayers, crtAffectText, selectedLayerId, gifFrameIndex]);

  const renderRef = useRef(render);
  useEffect(() => {
    renderRef.current = render;
    frameIndexRef.current = gifFrameIndex;
    render();
  }, [render, gifFrameIndex]);

  useEffect(() => {
    const video = media?.type === 'video' ? media.video : undefined;
    if (!video) return;
    const repaint = () => renderRef.current();
    video.addEventListener('loadeddata', repaint);
    video.addEventListener('seeked', repaint);
    return () => {
      video.removeEventListener('loadeddata', repaint);
      video.removeEventListener('seeked', repaint);
    };
  }, [media]);

  useEffect(() => {
    if (!media || !isPlaying) return;

    if (isFrameSequenceMedia(media) && media.gifFrames) {
      if (!onGifFrameChange) return;
      const frames = media.gifFrames;
      let frameIdx = frameIndexRef.current % frames.length;
      let due = performance.now() + frames[frameIdx].delay;
      let handle = 0;

      const animate = (now: number) => {
        if (now >= due) {
          if (now - due > MAX_CATCH_UP_MS) due = now;
          while (now >= due) {
            frameIdx = (frameIdx + 1) % frames.length;
            due += frames[frameIdx].delay;
          }
          onGifFrameChange(frameIdx);
        }
        handle = requestAnimationFrame(animate);
      };

      handle = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(handle);
    }

    const video = media.type === 'video' ? media.video : undefined;
    if (!video) return;

    if (controlsPlayback) {
      video.play().catch((err: unknown) => console.warn('Preview playback failed', err));
    }
    const hasVideoFrameCallback = typeof video.requestVideoFrameCallback === 'function';
    let handle = 0;
    const tick = () => {
      renderRef.current();
      handle = hasVideoFrameCallback
        ? video.requestVideoFrameCallback(tick)
        : requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (hasVideoFrameCallback) video.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
      if (controlsPlayback) video.pause();
    };
  }, [media, isPlaying, onGifFrameChange, controlsPlayback]);

  useEffect(() => {
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  return { canvasRef, render };
}
