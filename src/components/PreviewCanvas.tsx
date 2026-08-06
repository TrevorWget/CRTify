import { useCallback, useRef, useState } from 'react';
import type { CrtSettings, LoadedMedia, TextLayer } from '../types/crt';
import { useCrtRenderer } from '../hooks/useCrtRenderer';
import { hitTestTextLayer } from '../utils/textCompositor';

interface PreviewCanvasProps {
  media: LoadedMedia | null;
  settings: CrtSettings;
  textLayers: TextLayer[];
  crtAffectText: boolean;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, partial: Partial<TextLayer>) => void;
  gifFrameIndex: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onGifFrameChange: (index: number) => void;
}

export function PreviewCanvas({
  media,
  settings,
  textLayers,
  crtAffectText,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  gifFrameIndex,
  isPlaying,
  onTogglePlay,
  onGifFrameChange,
}: PreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(
    null,
  );

  const { canvasRef } = useCrtRenderer({
    media,
    settings,
    textLayers,
    crtAffectText,
    selectedLayerId,
    gifFrameIndex,
    isPlaying,
    onGifFrameChange,
  });

  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [canvasRef],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!media) return;
      const coords = getCanvasCoords(e.clientX, e.clientY);
      if (!coords) return;

      const hit = hitTestTextLayer(textLayers, media.width, media.height, coords.x, coords.y);
      if (hit && !hit.locked) {
        onSelectLayer(hit.id);
        setDragging({
          id: hit.id,
          offsetX: coords.x / media.width - hit.x,
          offsetY: coords.y / media.height - hit.y,
        });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        onSelectLayer(null);
      }
    },
    [media, textLayers, getCanvasCoords, onSelectLayer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !media) return;
      const coords = getCanvasCoords(e.clientX, e.clientY);
      if (!coords) return;

      const x = Math.max(0, Math.min(1, coords.x / media.width - dragging.offsetX));
      const y = Math.max(0, Math.min(1, coords.y / media.height - dragging.offsetY));
      onUpdateLayer(dragging.id, { x, y });
    },
    [dragging, media, getCanvasCoords, onUpdateLayer],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <div className="preview-canvas" ref={containerRef}>
      {!media ? (
        <div className="preview-placeholder">
          <span className="preview-icon">▣</span>
          <p>Upload an image, GIF, or video to preview CRT effects</p>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className="preview-output"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {(media.type === 'gif' || media.type === 'video') && (
            <div className="playback-controls">
              <button type="button" className="btn btn-small" onClick={onTogglePlay}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
