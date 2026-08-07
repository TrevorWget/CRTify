import { useCallback, useEffect, useRef } from 'react';
import type { CrtSettings, LoadedMedia, TextLayer } from '../types/crt';
import { CrtRenderer } from '../utils/webgl';
import { drawTextLayers } from '../utils/textCompositor';
import { imageDataToCanvas } from '../utils/mediaLoader';
import { isFrameSequenceMedia } from '../utils/animationMedia';

interface UseCrtRendererOptions {
  media: LoadedMedia | null;
  settings: CrtSettings;
  textLayers: TextLayer[];
  crtAffectText: boolean;
  selectedLayerId: string | null;
  gifFrameIndex: number;
  isPlaying: boolean;
  onGifFrameChange?: (index: number) => void;
}

export function useCrtRenderer({
  media,
  settings,
  textLayers,
  crtAffectText,
  selectedLayerId,
  gifFrameIndex,
  isPlaying,
  onGifFrameChange,
}: UseCrtRendererOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CrtRenderer | null>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  const render = useCallback(() => {
    if (!media || !canvasRef.current) return;

    if (!rendererRef.current) {
      rendererRef.current = new CrtRenderer();
    }

    const renderer = rendererRef.current;
    let source: CanvasImageSource | null = null;
    let time = timeRef.current;

    if (media.type === 'image' && media.image) {
      source = media.image;
    } else if (isFrameSequenceMedia(media) && media.gifFrames) {
      const frame = media.gifFrames[gifFrameIndex % media.gifFrames.length];
      source = imageDataToCanvas(frame.imageData);
      time = gifFrameIndex * 0.1;
    } else if (media.type === 'video' && media.video) {
      source = media.video;
      time = media.video.currentTime;
    }

    if (!source) return;

    const crtCanvas = renderer.renderFrame(source, settings, time, { preserveAlpha: true });
    const displayCanvas = canvasRef.current;
    displayCanvas.width = crtCanvas.width;
    displayCanvas.height = crtCanvas.height;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    ctx.drawImage(crtCanvas, 0, 0);
    drawTextLayers(displayCanvas, textLayers, settings, crtAffectText, selectedLayerId);
  }, [media, settings, textLayers, crtAffectText, selectedLayerId, gifFrameIndex]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    if (!media || !isPlaying) return;

    if (isFrameSequenceMedia(media) && media.gifFrames) {
      let frameIdx = gifFrameIndex;
      let lastTime = performance.now();

      const animate = (now: number) => {
        const frames = media.gifFrames!;
        const delay = frames[frameIdx % frames.length].delay;
        if (now - lastTime >= delay) {
          frameIdx = (frameIdx + 1) % frames.length;
          lastTime = now;
          timeRef.current = frameIdx * 0.1;
          onGifFrameChange?.(frameIdx);
        }
        animFrameRef.current = requestAnimationFrame(animate);
      };

      animFrameRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animFrameRef.current);
    }

    if (media.type === 'video' && media.video) {
      media.video.play();
      const animate = () => {
        render();
        if (!media.video!.paused && !media.video!.ended) {
          animFrameRef.current = requestAnimationFrame(animate);
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
      return () => {
        cancelAnimationFrame(animFrameRef.current);
        media.video?.pause();
      };
    }
  }, [media, isPlaying, gifFrameIndex, render, onGifFrameChange]);

  useEffect(() => {
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  return { canvasRef, render };
}
