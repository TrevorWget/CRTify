import { useEffect, useMemo, useState } from 'react';
import type {
  ExportFormat,
  ExportOptionsConfig,
  ExportProgress,
  ExportSizeMode,
  LoadedMedia,
} from '../types/crt';
import { defaultExportFilename } from '../utils/imageExport';

interface ExportPanelProps {
  media: LoadedMedia | null;
  exporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
  defaultName: string;
  onExport: (format: ExportFormat, config: ExportOptionsConfig) => void;
  onClearError: () => void;
}

const IMAGE_FORMATS: ExportFormat[] = ['png', 'jpeg'];
const GIF_FORMATS: ExportFormat[] = ['gif'];
const VIDEO_FORMATS: ExportFormat[] = ['mp4', 'webm'];

const SIZE_OPTIONS: { id: ExportSizeMode; label: string; hint: string }[] = [
  { id: 'original', label: 'Original', hint: '100%' },
  { id: 'medium', label: 'Medium', hint: '75%' },
  { id: 'small', label: 'Small', hint: '50%' },
];

export function ExportPanel({
  media,
  exporting,
  progress,
  error,
  defaultName,
  onExport,
  onClearError,
}: ExportPanelProps) {
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState(defaultName);
  const [sizeMode, setSizeMode] = useState<ExportSizeMode>('original');
  const [optimize, setOptimize] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('png');

  const availableFormats = useMemo(() => {
    const formats: ExportFormat[] = [];
    if (!media) return formats;
    formats.push(...IMAGE_FORMATS);
    if (media.type === 'gif') formats.push(...GIF_FORMATS);
    if (media.type === 'video') formats.push(...VIDEO_FORMATS);
    return [...new Set(formats)];
  }, [media]);

  useEffect(() => {
    setFilename(defaultName);
  }, [defaultName]);

  useEffect(() => {
    if (!availableFormats.includes(format) && availableFormats.length > 0) {
      setFormat(availableFormats[0]);
    }
  }, [availableFormats, format]);

  const optimizeHint =
    format === 'png'
      ? 'PNG keeps full quality; use JPEG or smaller size for lighter files'
      : format === 'jpeg'
        ? 'Lower JPEG quality for smaller files'
        : format === 'gif'
          ? 'Coarser palette for smaller GIFs'
          : 'Lower bitrate / CRF and slightly fewer frames';

  return (
    <div className="export-panel">
      <button
        type="button"
        className="btn btn-primary export-btn"
        disabled={!media || exporting}
        onClick={() => setOpen(!open)}
      >
        {exporting ? 'Exporting...' : 'Export ▼'}
      </button>

      {open && media && !exporting && (
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
            <div className="segmented-control">
              {availableFormats.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={format === item ? 'active' : ''}
                  onClick={() => setFormat(item)}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="export-field">
            <span>Size</span>
            <div className="segmented-control">
              {SIZE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={sizeMode === option.id ? 'active' : ''}
                  onClick={() => setSizeMode(option.id)}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="export-field export-toggle">
            <span>
              Optimize file size
              <small>{optimizeHint}</small>
            </span>
            <input
              type="checkbox"
              checked={optimize}
              onChange={(event) => setOptimize(event.target.checked)}
            />
          </label>

          <button
            type="button"
            className="btn btn-primary export-confirm"
            onClick={() => {
              onExport(format, {
                filename: filename.trim() || defaultName,
                sizeMode,
                optimize,
              });
              setOpen(false);
            }}
          >
            Download {format.toUpperCase()}
          </button>
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
