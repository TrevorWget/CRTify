import type { ExportFormat, LoadedMedia } from '../types/crt';
import { supportsWebpExport } from './imageExport';

/** Prefer an export format that matches the uploaded source type. */
export function preferredExportFormat(media: LoadedMedia | null): ExportFormat {
  if (!media) return 'png';

  const name = (media.fileName ?? media.sourceFile?.name ?? '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() ?? '' : '';

  if (media.type === 'gif' || ext === 'gif') return 'gif';
  if (media.type === 'webp' || ext === 'webp') {
    return supportsWebpExport() ? 'webp' : 'png';
  }
  if (media.type === 'video') {
    if (ext === 'webm') return 'webm';
    return 'mp4';
  }

  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  if (ext === 'webp' && supportsWebpExport()) return 'webp';
  if (ext === 'png' || ext === 'bmp') return 'png';
  return 'png';
}
