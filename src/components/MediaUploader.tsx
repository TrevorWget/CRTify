import { useCallback } from 'react';
import type { LoadedMedia } from '../types/crt';
import { isFrameSequenceMedia } from '../utils/animationMedia';

interface MediaUploaderProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
  media: LoadedMedia | null;
  onClear: () => void;
}

export function MediaUploader({ onFileSelect, loading, media, onClear }: MediaUploaderProps) {
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

  return (
    <div className="media-uploader">
      <h3>Media</h3>
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
      )}
    </div>
  );
}
