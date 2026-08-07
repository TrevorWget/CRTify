import type { ExportFormat } from '../types/crt';

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

export function percentToScale(scalePercent: number): number {
  return Math.min(1, Math.max(0.1, scalePercent / 100));
}

export function getVideoBitrate(optimize: boolean, scalePercent: number): number {
  const base = optimize ? 1_500_000 : 5_000_000;
  return Math.round(base * percentToScale(scalePercent));
}

export function getVideoCrf(optimize: boolean): number {
  return optimize ? 28 : 23;
}

export function supportsWebpExport(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

export function exportCanvasImage(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg' | 'webp',
  quality = 0.92,
): Promise<Blob> {
  const mimeType =
    format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Failed to export ${format.toUpperCase()} image`));
      },
      mimeType,
      format === 'png' ? undefined : quality,
    );
  });
}

export function getExportExtension(format: ExportFormat): string {
  switch (format) {
    case 'png':
      return 'png';
    case 'jpeg':
      return 'jpg';
    case 'webp':
      return 'webp';
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
