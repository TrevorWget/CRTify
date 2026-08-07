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

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

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
  const [zoom, setZoom] = useState(1);

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

  const adjustZoom = useCallback((delta: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))));
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
          <div className="preview-toolbar">
            <div className="zoom-controls">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => adjustZoom(-ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
                title="Zoom out"
              >
                −
              </button>
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => adjustZoom(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                title="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setZoom(1)}
                disabled={zoom === 1}
              >
                Reset
              </button>
            </div>
            {(media.type === 'gif' || media.type === 'video') && (
              <button type="button" className="btn btn-small" onClick={onTogglePlay}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
            )}
          </div>
          <div className="preview-stage">
            <canvas
              ref={canvasRef}
              className="preview-output"
              style={{ transform: `scale(${zoom})` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
        </>
      )}
    </div>
  );
}
