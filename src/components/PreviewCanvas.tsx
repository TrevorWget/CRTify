import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrtSettings, LoadedMedia, TextLayer } from '../types/crt';
import { useCrtRenderer } from '../hooks/useCrtRenderer';
import { hitTestTextLayer } from '../utils/textCompositor';
import {
  getTimelinePosition,
  isFrameSequenceMedia,
  isPlayableMedia,
} from '../utils/animationMedia';
import { positionUpdate, resolveLayersForRender } from '../utils/keyframes';

interface PreviewCanvasProps {
  media: LoadedMedia | null;
  settings: CrtSettings;
  settingsB?: CrtSettings | null;
  compareEnabled?: boolean;
  textLayers: TextLayer[];
  crtAffectText: boolean;
  crtAffectTextB?: boolean;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, partial: Partial<TextLayer>) => void;
  gifFrameIndex: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onGifFrameChange: (index: number) => void;
  onVideoTimeChange?: (seconds: number) => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function PreviewCanvas({
  media,
  settings,
  settingsB = null,
  compareEnabled = false,
  textLayers,
  crtAffectText,
  crtAffectTextB = false,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  gifFrameIndex,
  isPlaying,
  onTogglePlay,
  onGifFrameChange,
  onVideoTimeChange,
}: PreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
    timeline: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(true);
  const [videoTime, setVideoTime] = useState(0);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewVolume, setPreviewVolume] = useState(1);

  const { canvasRef, render } = useCrtRenderer({
    media,
    settings,
    textLayers,
    crtAffectText,
    selectedLayerId: compareEnabled ? null : selectedLayerId,
    gifFrameIndex,
    isPlaying,
    onGifFrameChange,
  });

  const { canvasRef: canvasRefB } = useCrtRenderer({
    media,
    settings: settingsB ?? settings,
    textLayers,
    crtAffectText: crtAffectTextB,
    selectedLayerId: null,
    gifFrameIndex,
    isPlaying,
    onGifFrameChange: undefined,
  });

  const computeFitZoom = useCallback(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas || !media) return 1;

    const availableWidth = Math.max(1, stage.clientWidth - 24);
    const availableHeight = Math.max(1, stage.clientHeight - 24);
    const fit = Math.min(availableWidth / media.width, availableHeight / media.height);
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(fit.toFixed(4))));
  }, [canvasRef, media]);

  const applyFit = useCallback(() => {
    setFitMode(true);
    setZoom(computeFitZoom());
  }, [computeFitZoom]);

  useEffect(() => {
    if (!media) return;
    applyFit();
  }, [media, applyFit]);

  useEffect(() => {
    if (!fitMode) return;
    const stage = stageRef.current;
    if (!stage) return;

    const observer = new ResizeObserver(() => {
      setZoom(computeFitZoom());
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [fitMode, computeFitZoom]);

  useEffect(() => {
    const video = media?.type === 'video' ? media.video : null;
    if (!video) {
      setVideoTime(0);
      return;
    }

    const sync = () => {
      setVideoTime(video.currentTime);
      onVideoTimeChange?.(video.currentTime);
    };
    sync();
    video.addEventListener('timeupdate', sync);
    video.addEventListener('seeked', sync);
    video.addEventListener('loadedmetadata', sync);
    return () => {
      video.removeEventListener('timeupdate', sync);
      video.removeEventListener('seeked', sync);
      video.removeEventListener('loadedmetadata', sync);
    };
  }, [media, onVideoTimeChange]);

  useEffect(() => {
    const video = media?.type === 'video' ? media.video : null;
    if (!video) return;
    video.muted = previewMuted;
    video.volume = previewVolume;
  }, [media, previewMuted, previewVolume]);

  const adjustPreviewVolume = useCallback((delta: number) => {
    setPreviewVolume((current) => {
      const next = Math.min(1, Math.max(0, Number((current + delta).toFixed(2))));
      if (next > 0) setPreviewMuted(false);
      return next;
    });
  }, []);

  const togglePreviewMute = useCallback(() => {
    setPreviewMuted((current) => !current);
  }, []);

  const scrubTo = useCallback(
    (value: number) => {
      if (!media) return;
      if (isPlaying) onTogglePlay();

      if (isFrameSequenceMedia(media)) {
        onGifFrameChange(Math.round(value));
        return;
      }
      const video = media.type === 'video' ? media.video : null;
      if (!video) return;
      video.currentTime = value;
      setVideoTime(value);
      onVideoTimeChange?.(value);
      // Seeking does not re-run React state, so repaint once the frame lands.
      const repaint = () => {
        render();
        video.removeEventListener('seeked', repaint);
      };
      video.addEventListener('seeked', repaint);
    },
    [media, isPlaying, onTogglePlay, onGifFrameChange, onVideoTimeChange, render],
  );

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

      // Hit test against animated positions so clicks match what is drawn.
      const timeline = getTimelinePosition(media, gifFrameIndex, videoTime);
      const hit = hitTestTextLayer(
        resolveLayersForRender(textLayers, timeline),
        media.width,
        media.height,
        coords.x,
        coords.y,
      );
      if (hit && !hit.locked) {
        onSelectLayer(hit.id);
        setDragging({
          id: hit.id,
          offsetX: coords.x / media.width - hit.x,
          offsetY: coords.y / media.height - hit.y,
          timeline,
        });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        onSelectLayer(null);
      }
    },
    [media, textLayers, gifFrameIndex, videoTime, getCanvasCoords, onSelectLayer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !media) return;
      const coords = getCanvasCoords(e.clientX, e.clientY);
      if (!coords) return;

      const x = Math.max(0, Math.min(1, coords.x / media.width - dragging.offsetX));
      const y = Math.max(0, Math.min(1, coords.y / media.height - dragging.offsetY));

      const layer = textLayers.find((item) => item.id === dragging.id);
      if (!layer) return;
      onUpdateLayer(dragging.id, positionUpdate(layer, { x, y }, dragging.timeline));
    },
    [dragging, media, textLayers, getCanvasCoords, onUpdateLayer],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const frameCount = media?.gifFrames?.length ?? 0;
  const videoDuration =
    media?.type === 'video' && media.video && Number.isFinite(media.video.duration)
      ? media.video.duration
      : 0;
  const usesFrames = isFrameSequenceMedia(media);
  const scrubMax = usesFrames ? Math.max(0, frameCount - 1) : videoDuration;
  const scrubStep = usesFrames ? 1 : 0.01;
  const scrubValue = usesFrames
    ? Math.min(gifFrameIndex, Math.max(0, frameCount - 1))
    : Math.min(videoTime, videoDuration);
  const scrubLabel = usesFrames
    ? `${Math.min(gifFrameIndex + 1, frameCount)}/${frameCount}`
    : `${videoTime.toFixed(1)}s`;

  const adjustZoom = useCallback((delta: number) => {
    setFitMode(false);
    setZoom((current) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))),
    );
  }, []);

  return (
    <div className="preview-canvas" ref={containerRef}>
      {!media ? (
        <div className="preview-placeholder">
          <div className="placeholder-reticle" aria-hidden="true">
            <span className="preview-icon">CRT</span>
          </div>
          <span className="placeholder-code">NO SIGNAL // INPUT 01</span>
          <p>INSERT MEDIA</p>
          <small>IMAGE · GIF · ANIMATED WEBP · VIDEO</small>
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
                className={`btn btn-small ${fitMode ? 'active' : ''}`}
                onClick={applyFit}
                title="Fit preview to window"
              >
                Fit
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  setFitMode(false);
                  setZoom(1);
                }}
                disabled={!fitMode && zoom === 1}
              >
                100%
              </button>
            </div>
            {isPlayableMedia(media) && (
              <div className="transport-controls">
                <button type="button" className="btn btn-small" onClick={onTogglePlay}>
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <input
                  className="scrubber"
                  type="range"
                  min={0}
                  max={scrubMax}
                  step={scrubStep}
                  value={scrubValue}
                  onChange={(event) => scrubTo(Number(event.target.value))}
                  aria-label="Timeline position"
                  title="Scrub timeline"
                />
                <span className="scrub-label">{scrubLabel}</span>
              </div>
            )}
            {media.type === 'video' && (
              <div className="audio-controls" aria-label="Preview audio">
                <button
                  type="button"
                  className={`btn btn-small audio-btn ${previewMuted ? 'active' : ''}`}
                  onClick={togglePreviewMute}
                  title={previewMuted ? 'Unmute preview audio' : 'Mute preview audio'}
                >
                  {previewMuted ? 'MUTE' : 'AUD'}
                </button>
                <button
                  type="button"
                  className="btn btn-small audio-btn"
                  onClick={() => adjustPreviewVolume(-0.1)}
                  disabled={previewMuted || previewVolume <= 0}
                  title="Lower preview volume"
                >
                  VOL−
                </button>
                <span className="audio-level">{Math.round(previewVolume * 100)}</span>
                <button
                  type="button"
                  className="btn btn-small audio-btn"
                  onClick={() => adjustPreviewVolume(0.1)}
                  disabled={previewMuted || previewVolume >= 1}
                  title="Raise preview volume"
                >
                  VOL+
                </button>
              </div>
            )}
          </div>
          <div
            className={`preview-stage${compareEnabled && settingsB ? ' preview-stage-compare' : ''}`}
            ref={stageRef}
          >
            <div className="preview-compare-pane">
              {compareEnabled && <span className="compare-badge">A</span>}
              <canvas
                ref={canvasRef}
                className="preview-output"
                style={{
                  width: `${media.width * zoom * (compareEnabled ? 0.5 : 1)}px`,
                  height: `${media.height * zoom * (compareEnabled ? 0.5 : 1)}px`,
                }}
                onPointerDown={compareEnabled ? undefined : handlePointerDown}
                onPointerMove={compareEnabled ? undefined : handlePointerMove}
                onPointerUp={compareEnabled ? undefined : handlePointerUp}
                onPointerLeave={compareEnabled ? undefined : handlePointerUp}
              />
            </div>
            {compareEnabled && settingsB && (
              <div className="preview-compare-pane">
                <span className="compare-badge">B</span>
                <canvas
                  ref={canvasRefB}
                  className="preview-output"
                  style={{
                    width: `${media.width * zoom * 0.5}px`,
                    height: `${media.height * zoom * 0.5}px`,
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
