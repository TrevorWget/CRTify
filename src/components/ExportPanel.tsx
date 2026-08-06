import { useState } from 'react';
import type { ExportFormat, ExportProgress, LoadedMedia } from '../types/crt';

interface ExportPanelProps {
  media: LoadedMedia | null;
  exporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
  onExport: (format: ExportFormat) => void;
  onClearError: () => void;
}

const IMAGE_FORMATS: ExportFormat[] = ['png', 'jpeg'];
const GIF_FORMATS: ExportFormat[] = ['gif'];
const VIDEO_FORMATS: ExportFormat[] = ['mp4', 'webm'];

export function ExportPanel({
  media,
  exporting,
  progress,
  error,
  onExport,
  onClearError,
}: ExportPanelProps) {
  const [open, setOpen] = useState(false);

  const availableFormats: ExportFormat[] = [];
  if (media) {
    availableFormats.push(...IMAGE_FORMATS);
    if (media.type === 'gif') availableFormats.push(...GIF_FORMATS);
    if (media.type === 'video') availableFormats.push(...VIDEO_FORMATS);
  }

  const uniqueFormats = [...new Set(availableFormats)];

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
        <div className="export-dropdown">
          {uniqueFormats.map((format) => (
            <button
              key={format}
              type="button"
              className="export-option"
              onClick={() => {
                onExport(format);
                setOpen(false);
              }}
            >
              {format.toUpperCase()}
            </button>
          ))}
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
