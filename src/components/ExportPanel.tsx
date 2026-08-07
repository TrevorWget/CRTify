import { useEffect, useMemo, useState } from 'react';
import {
  defaultExportOptions,
  type ExportFormat,
  type ExportOptionsConfig,
  type ExportProgress,
  type ExportQueueItem,
  type ExportRecipe,
  type LoadedMedia,
} from '../types/crt';
import { isFrameSequenceMedia } from '../utils/animationMedia';
import { preferredExportFormat } from '../utils/exportDefaults';
import {
  deleteExportRecipe,
  listExportRecipes,
  saveExportRecipe,
} from '../utils/exportRecipes';
import { defaultExportFilename, supportsWebpExport } from '../utils/imageExport';

interface ExportPanelProps {
  media: LoadedMedia | null;
  exporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
  defaultName: string;
  queue: ExportQueueItem[];
  timeline?: number;
  onExport: (format: ExportFormat, config: ExportOptionsConfig) => void;
  onEnqueue: (format: ExportFormat, config: ExportOptionsConfig) => void;
  onClearFinished: () => void;
  onClearError: () => void;
}

const SCALE_PRESETS = [100, 75, 50, 25];

export function ExportPanel({
  media,
  exporting,
  progress,
  error,
  defaultName,
  queue,
  timeline = 0,
  onExport,
  onEnqueue,
  onClearFinished,
  onClearError,
}: ExportPanelProps) {
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState(defaultName);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scalePercent, setScalePercent] = useState(100);
  const [imageQuality, setImageQuality] = useState(0.92);
  const [gifQuality, setGifQuality] = useState(10);
  const [frameSkip, setFrameSkip] = useState(1);
  const [dither, setDither] = useState(false);
  const [optimizeVideo, setOptimizeVideo] = useState(false);
  const [keepAudio, setKeepAudio] = useState(true);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [recipes, setRecipes] = useState<ExportRecipe[]>(() => listExportRecipes());
  const [recipeName, setRecipeName] = useState('');

  const webpSupported = useMemo(() => supportsWebpExport(), []);
  const animatedSource = isFrameSequenceMedia(media);

  const availableFormats = useMemo(() => {
    const formats: ExportFormat[] = [];
    if (!media) return formats;
    formats.push('png', 'jpeg');
    if (webpSupported) formats.push('webp');
    formats.push('gif');
    formats.push('mp4', 'webm');
    return formats;
  }, [media, webpSupported]);

  useEffect(() => {
    setFilename(defaultName);
  }, [defaultName]);

  useEffect(() => {
    if (!media || availableFormats.length === 0) return;
    const preferred = preferredExportFormat(media);
    setFormat(availableFormats.includes(preferred) ? preferred : availableFormats[0]);
  }, [media, availableFormats]);

  useEffect(() => {
    if (!availableFormats.includes(format) && availableFormats.length > 0) {
      setFormat(availableFormats[0]);
    }
  }, [availableFormats, format]);

  const handleOpenExport = () => {
    if (!media || exporting) return;
    if (!open) {
      const preferred = preferredExportFormat(media);
      if (availableFormats.includes(preferred)) setFormat(preferred);
    }
    setOpen(!open);
  };

  const scaledWidth = media ? Math.max(1, Math.round(media.width * (scalePercent / 100))) : 0;
  const scaledHeight = media ? Math.max(1, Math.round(media.height * (scalePercent / 100))) : 0;
  const animatedWebpExport = format === 'webp' && animatedSource;
  const showFrameSkip =
    format === 'gif' || format === 'mp4' || format === 'webm' || animatedWebpExport;
  const showImageQuality = format === 'jpeg' || format === 'webp';
  const showGifControls = format === 'gif';
  const showVideoOptimize = format === 'mp4' || format === 'webm';
  const showKeepAudio = showVideoOptimize && media?.type === 'video';
  const showRange =
    format === 'gif' ||
    format === 'mp4' ||
    format === 'webm' ||
    animatedWebpExport ||
    (format === 'webp' && media?.type === 'video');

  const formatLabel = (item: ExportFormat) => {
    if (item === 'webp' && animatedSource) return 'WEBP (anim)';
    return item.toUpperCase();
  };

  const applyCompactPreset = () => {
    setScalePercent(50);
    setImageQuality(0.72);
    setGifQuality(18);
    setFrameSkip(2);
    setDither(false);
    setOptimizeVideo(true);
    setRangeStart(0);
    setRangeEnd(1);
  };

  const applyDefaultPreset = () => {
    const defaults = defaultExportOptions();
    setScalePercent(defaults.scalePercent);
    setImageQuality(defaults.imageQuality);
    setGifQuality(defaults.gifQuality);
    setFrameSkip(defaults.frameSkip);
    setDither(defaults.dither);
    setOptimizeVideo(defaults.optimizeVideo);
    setKeepAudio(defaults.keepAudio);
    setRangeStart(defaults.rangeStart);
    setRangeEnd(defaults.rangeEnd);
  };

  const currentOptions = (): ExportOptionsConfig => ({
    filename: filename.trim() || defaultName,
    scalePercent,
    imageQuality,
    gifQuality,
    frameSkip,
    dither,
    optimizeVideo,
    keepAudio,
    rangeStart: Math.min(rangeStart, rangeEnd),
    rangeEnd: Math.max(rangeStart, rangeEnd),
  });

  const applyRecipe = (recipe: ExportRecipe) => {
    setFormat(recipe.format);
    setScalePercent(recipe.options.scalePercent);
    setImageQuality(recipe.options.imageQuality);
    setGifQuality(recipe.options.gifQuality);
    setFrameSkip(recipe.options.frameSkip);
    setDither(recipe.options.dither);
    setOptimizeVideo(recipe.options.optimizeVideo);
    setKeepAudio(recipe.options.keepAudio);
    setRangeStart(recipe.options.rangeStart ?? 0);
    setRangeEnd(recipe.options.rangeEnd ?? 1);
    if (recipe.options.filename) setFilename(recipe.options.filename);
  };

  return (
    <div className="export-panel">
      <button
        type="button"
        className="btn btn-primary export-btn"
        disabled={!media || exporting}
        onClick={handleOpenExport}
      >
        {exporting ? 'Exporting...' : 'Export ▼'}
      </button>

      {open && media && (
        <div className="export-dropdown export-menu">
          <label className="export-field">
            <span>Filename</span>
            <input
              type="text"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              placeholder={defaultExportFilename(undefined)}
            />
          </label>

          <div className="export-field">
            <span>Format</span>
            <div className="segmented-control wrap">
              {availableFormats.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={format === item ? 'active' : ''}
                  onClick={() => setFormat(item)}
                >
                  {formatLabel(item)}
                </button>
              ))}
            </div>
            {animatedWebpExport && (
              <small>Exports the full animation as animated WebP.</small>
            )}
          </div>

          <div className="export-field">
            <span>
              Resolution scale
              <span className="control-value">
                {scalePercent}% · {scaledWidth}×{scaledHeight}
              </span>
            </span>
            <div className="segmented-control">
              {SCALE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={scalePercent === preset ? 'active' : ''}
                  onClick={() => setScalePercent(preset)}
                >
                  {preset}%
                </button>
              ))}
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={scalePercent}
              onChange={(event) => setScalePercent(Number(event.target.value))}
            />
          </div>

          {showImageQuality && (
            <label className="export-field">
              <span>
                Image quality
                <span className="control-value">{Math.round(imageQuality * 100)}%</span>
              </span>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={Math.round(imageQuality * 100)}
                onChange={(event) => setImageQuality(Number(event.target.value) / 100)}
              />
            </label>
          )}

          {showGifControls && (
            <>
              <label className="export-field">
                <span>
                  GIF encoder quality
                  <span className="control-value">{gifQuality}</span>
                </span>
                <small>Lower = better colors / larger files. Higher = smaller files.</small>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={gifQuality}
                  onChange={(event) => setGifQuality(Number(event.target.value))}
                />
              </label>
              <label className="export-field export-toggle">
                <span>
                  Dithering
                  <small>Smoother gradients, usually larger GIFs</small>
                </span>
                <input
                  type="checkbox"
                  checked={dither}
                  onChange={(event) => setDither(event.target.checked)}
                />
              </label>
            </>
          )}

          {showFrameSkip && (
            <label className="export-field">
              <span>
                Keep every Nth frame
                <span className="control-value">{frameSkip}</span>
              </span>
              <small>
                {frameSkip === 1
                  ? 'Export every frame'
                  : `Skip frames for roughly ${Math.round(100 / frameSkip)}% of the motion samples`}
              </small>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={frameSkip}
                onChange={(event) => setFrameSkip(Number(event.target.value))}
              />
            </label>
          )}

          {showRange && (
            <div className="export-field export-range">
              <span>
                In / Out
                <span className="control-value">
                  {Math.round(Math.min(rangeStart, rangeEnd) * 100)}–
                  {Math.round(Math.max(rangeStart, rangeEnd) * 100)}%
                </span>
              </span>
              <small>Export only this portion of the timeline (keyframes stay media-relative).</small>
              <label className="export-range-slider">
                <span>In</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(rangeStart * 100)}
                  onChange={(event) => {
                    const next = Number(event.target.value) / 100;
                    setRangeStart(next);
                    if (next > rangeEnd) setRangeEnd(next);
                  }}
                />
              </label>
              <label className="export-range-slider">
                <span>Out</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(rangeEnd * 100)}
                  onChange={(event) => {
                    const next = Number(event.target.value) / 100;
                    setRangeEnd(next);
                    if (next < rangeStart) setRangeStart(next);
                  }}
                />
              </label>
              <div className="export-range-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    const t = Math.min(1, Math.max(0, timeline));
                    setRangeStart(t);
                    if (t > rangeEnd) setRangeEnd(t);
                  }}
                >
                  Set In
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    const t = Math.min(1, Math.max(0, timeline));
                    setRangeEnd(t);
                    if (t < rangeStart) setRangeStart(t);
                  }}
                >
                  Set Out
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    setRangeStart(0);
                    setRangeEnd(1);
                  }}
                >
                  Full
                </button>
              </div>
            </div>
          )}

          {showVideoOptimize && (
            <label className="export-field export-toggle">
              <span>
                Optimize video bitrate
                <small>Higher CRF / lower bitrate and slightly fewer fps</small>
              </span>
              <input
                type="checkbox"
                checked={optimizeVideo}
                onChange={(event) => setOptimizeVideo(event.target.checked)}
              />
            </label>
          )}

          {showKeepAudio && (
            <label className="export-field export-toggle">
              <span>
                Keep audio track
                <small>Include source audio when exporting video</small>
              </span>
              <input
                type="checkbox"
                checked={keepAudio}
                onChange={(event) => setKeepAudio(event.target.checked)}
              />
            </label>
          )}

          <div className="export-field">
            <span>Export recipes</span>
            <div className="segmented-control wrap">
              {recipes.map((recipe) => (
                <span key={recipe.id} className="preset-rack-item">
                  <button
                    type="button"
                    title={recipe.description ?? recipe.name}
                    onClick={() => applyRecipe(recipe)}
                  >
                    {recipe.name}
                  </button>
                  {!recipe.builtin && (
                    <button
                      type="button"
                      className="btn-icon btn-danger preset-delete"
                      title={`Delete ${recipe.name}`}
                      onClick={() => {
                        deleteExportRecipe(recipe.id);
                        setRecipes(listExportRecipes());
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="preset-rack-save">
              <input
                type="text"
                placeholder="Recipe name"
                value={recipeName}
                onChange={(event) => setRecipeName(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  saveExportRecipe(recipeName, format, currentOptions());
                  setRecipeName('');
                  setRecipes(listExportRecipes());
                }}
              >
                Save recipe
              </button>
            </div>
          </div>

          <div className="export-presets">
            <button type="button" className="btn btn-small" onClick={applyDefaultPreset}>
              Quality defaults
            </button>
            <button type="button" className="btn btn-small" onClick={applyCompactPreset}>
              Compact preset
            </button>
          </div>

          <div className="export-actions-row">
            <button
              type="button"
              className="btn btn-primary export-confirm"
              disabled={exporting}
              onClick={() => {
                onExport(format, currentOptions());
              }}
            >
              Queue {formatLabel(format)}
            </button>
            <button
              type="button"
              className="btn btn-small"
              disabled={exporting}
              onClick={() => {
                onEnqueue(format, currentOptions());
              }}
            >
              + Add to queue
            </button>
          </div>

          {queue.length > 0 && (
            <div className="export-queue">
              <div className="export-queue-head">
                <span>Batch queue</span>
                <button type="button" className="btn btn-small" onClick={onClearFinished}>
                  Clear finished
                </button>
              </div>
              <ul className="export-queue-list">
                {queue.map((item) => (
                  <li key={item.id} className={`export-queue-item status-${item.status}`}>
                    <span>{item.label}</span>
                    <span className="export-queue-status">
                      {item.status}
                      {item.error ? ` · ${item.error}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {exporting && progress && (
        <div className="export-progress">
          <p>{progress.stage}</p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button type="button" className="btn-icon" onClick={onClearError}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
