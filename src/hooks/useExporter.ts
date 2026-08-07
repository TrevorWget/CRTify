import { useCallback, useState } from 'react';
import type {
  CrtSettings,
  ExportFormat,
  ExportOptionsConfig,
  ExportProgress,
  LoadedMedia,
  TextLayer,
} from '../types/crt';
import {
  downloadBlob,
  exportCanvasImage,
  getExportScale,
  scaleCanvas,
  withExportExtension,
} from '../utils/imageExport';
import { exportGif } from '../utils/gifPipeline';
import { exportVideo, exportVideoViaMediaRecorder } from '../utils/videoPipeline';
import { CrtRenderer } from '../utils/webgl';
import { drawTextLayers } from '../utils/textCompositor';
import { imageDataToCanvas } from '../utils/mediaLoader';

interface ExportOptions {
  media: LoadedMedia;
  settings: CrtSettings;
  textLayers: TextLayer[];
  crtAffectText: boolean;
  gifFrameIndex: number;
  exportConfig: ExportOptionsConfig;
}

export function useExporter() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportMedia = useCallback(
    async (format: ExportFormat, options: ExportOptions) => {
      const {
        media,
        settings,
        textLayers,
        crtAffectText,
        gifFrameIndex,
        exportConfig,
      } = options;
      setExporting(true);
      setError(null);
      setProgress({ stage: 'Starting export', progress: 0 });

      try {
        const filename = withExportExtension(exportConfig.filename, format);
        const { sizeMode, optimize } = exportConfig;
        const scale = getExportScale(sizeMode);

        if (format === 'png' || format === 'jpeg') {
          const renderer = new CrtRenderer();
          let source: CanvasImageSource | null = null;

          if (media.type === 'image' && media.image) {
            source = media.image;
          } else if (media.type === 'gif' && media.gifFrames) {
            const frame = media.gifFrames[gifFrameIndex % media.gifFrames.length];
            source = imageDataToCanvas(frame.imageData);
          } else if (media.type === 'video' && media.video) {
            source = media.video;
          }

          if (!source) throw new Error('No media to export');

          const crtCanvas = renderer.renderFrame(source, settings, 0, {
            preserveAlpha: format === 'png',
          });
          drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null);
          const outputCanvas = scaleCanvas(crtCanvas, scale);
          const blob = await exportCanvasImage(outputCanvas, format, optimize);
          downloadBlob(blob, filename);
          renderer.destroy();
        } else if (format === 'gif') {
          if (!media.gifFrames) throw new Error('No GIF frames to export');
          const blob = await exportGif(
            media.gifFrames,
            settings,
            textLayers,
            crtAffectText,
            setProgress,
            sizeMode,
            optimize,
          );
          downloadBlob(blob, filename);
        } else if (format === 'mp4' || format === 'webm') {
          if (!media.video) throw new Error('No video to export');
          let blob: Blob;
          try {
            blob = await exportVideo(
              media.video,
              settings,
              textLayers,
              crtAffectText,
              format,
              setProgress,
              sizeMode,
              optimize,
            );
          } catch {
            blob = await exportVideoViaMediaRecorder(
              media.video,
              settings,
              textLayers,
              crtAffectText,
              setProgress,
              sizeMode,
              optimize,
            );
          }
          downloadBlob(blob, filename);
        }

        setProgress({ stage: 'Done', progress: 1 });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed';
        setError(message);
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  return { exportMedia, exporting, progress, error, clearError: () => setError(null) };
}
