import { useCallback, useRef } from 'react';
import type { LoadedMedia } from '../types/crt';
import { isFrameSequenceMedia } from '../utils/animationMedia';

interface MediaUploaderProps {
  onFileSelect: (file: File) => void;
  onWebcamCapture: () => void;
  onBatchFiles: (files: File[]) => void;
  loading: boolean;
  media: LoadedMedia | null;
  onClear: () => void;
}

export function MediaUploader({
  onFileSelect,
  onWebcamCapture,
  onBatchFiles,
  loading,
  media,
  onClear,
}: MediaUploaderProps) {
  const batchInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
      e.target.value = '';
    },
    [onFileSelect],
  );

  const handleBatchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) onBatchFiles(files);
      e.target.value = '';
    },
    [onBatchFiles],
  );

  return (
    <div className="media-uploader">
      <div className="media-heading">
        <h3>Media</h3>
        {media?.fileName && (
          <span className="media-filename" title={media.fileName}>
            {media.fileName}
          </span>
        )}
      </div>
      {media ? (
        <div className="media-info">
          <p className="media-type">
            {media.type === 'webp' ? 'WEBP (anim)' : media.type?.toUpperCase()}
          </p>
          <p className="media-dims">
            {media.width} × {media.height}
          </p>
          {isFrameSequenceMedia(media) && media.gifFrames && (
            <p className="media-frames">{media.gifFrames.length} frames</p>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Remove
          </button>
        </div>
      ) : (
        <>
          <label
            className="drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*,video/*,.gif,.webp"
              onChange={handleChange}
              disabled={loading}
              hidden
            />
            <span className="drop-icon">⬆</span>
            <span>{loading ? 'Loading...' : 'Drop file or click to upload'}</span>
            <span className="drop-hint">Images, animated WebP, GIFs, or videos</span>
          </label>
          <div className="media-uploader-actions">
            <button
              type="button"
              className="btn btn-small"
              onClick={onWebcamCapture}
              disabled={loading}
            >
              Webcam
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => batchInputRef.current?.click()}
              disabled={loading}
            >
              Batch stills
            </button>
            <input
              ref={batchInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleBatchChange}
            />
          </div>
          <p className="drop-hint media-paste-hint">Tip: Ctrl/Cmd+V to paste an image from clipboard</p>
        </>
      )}
    </div>
  );
}
