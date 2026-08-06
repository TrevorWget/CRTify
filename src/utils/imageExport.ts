import type { ExportFormat } from '../types/crt';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCanvasImage(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg',
): Promise<Blob> {
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export image'));
      },
      mimeType,
      format === 'jpeg' ? 0.92 : undefined,
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
