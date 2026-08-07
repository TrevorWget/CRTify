import type { ExportFormat, ExportSizeMode } from '../types/crt';
import { EXPORT_SIZE_SCALES } from '../types/crt';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function sanitizeExportFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80);
  return cleaned || 'CRT_export';
}

export function defaultExportFilename(firstText: string | undefined): string {
  const label = firstText?.trim() || 'export';
  return sanitizeExportFilename(`CRT_${label}`);
}

export function scaleCanvas(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  if (scale >= 0.999) return source;

  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export function getExportScale(sizeMode: ExportSizeMode): number {
  return EXPORT_SIZE_SCALES[sizeMode];
}

export function getJpegQuality(optimize: boolean): number {
  return optimize ? 0.72 : 0.92;
}

export function getGifQuality(optimize: boolean, usesTransparency: boolean): number {
  if (optimize) return usesTransparency ? 12 : 18;
  return usesTransparency ? 5 : 10;
}

export function getVideoBitrate(optimize: boolean, sizeMode: ExportSizeMode): number {
  const base = optimize ? 1_500_000 : 5_000_000;
  return Math.round(base * EXPORT_SIZE_SCALES[sizeMode]);
}

export function getVideoCrf(optimize: boolean): number {
  return optimize ? 28 : 23;
}

export function exportCanvasImage(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg',
  optimize = false,
): Promise<Blob> {
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export image'));
      },
      mimeType,
      format === 'jpeg' ? getJpegQuality(optimize) : undefined,
    );
  });
}

export function getExportExtension(format: ExportFormat): string {
  switch (format) {
    case 'png':
      return 'png';
    case 'jpeg':
      return 'jpg';
    case 'gif':
      return 'gif';
    case 'mp4':
      return 'mp4';
    case 'webm':
      return 'webm';
  }
}

export function withExportExtension(filename: string, format: ExportFormat): string {
  const base = sanitizeExportFilename(filename.replace(/\.[^.]+$/, ''));
  return `${base}.${getExportExtension(format)}`;
}
