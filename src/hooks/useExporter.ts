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
  percentToScale,
  scaleCanvas,
  withExportExtension,
} from '../utils/imageExport';
import { exportGif } from '../utils/gifPipeline';
import { exportAnimatedWebp } from '../utils/webpPipeline';
import { exportVideo, exportVideoViaMediaRecorder } from '../utils/videoPipeline';
import { CrtRenderer } from '../utils/webgl';
import { drawTextLayers } from '../utils/textCompositor';
import { imageDataToCanvas } from '../utils/mediaLoader';
import { isFrameSequenceMedia } from '../utils/animationMedia';

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
        const scale = percentToScale(exportConfig.scalePercent);

        if (format === 'webp' && isFrameSequenceMedia(media) && media.gifFrames) {
          const blob = await exportAnimatedWebp(
            media.gifFrames,
            settings,
            textLayers,
            crtAffectText,
            setProgress,
            {
              scalePercent: exportConfig.scalePercent,
              imageQuality: exportConfig.imageQuality,
              frameSkip: exportConfig.frameSkip,
            },
          );
          downloadBlob(blob, filename);
        } else if (format === 'png' || format === 'jpeg' || format === 'webp') {
          const renderer = new CrtRenderer();
          let source: CanvasImageSource | null = null;

          if (media.type === 'image' && media.image) {
            source = media.image;
          } else if (isFrameSequenceMedia(media) && media.gifFrames) {
            const frame = media.gifFrames[gifFrameIndex % media.gifFrames.length];
            source = imageDataToCanvas(frame.imageData);
          } else if (media.type === 'video' && media.video) {
            source = media.video;
          }

          if (!source) throw new Error('No media to export');

          const crtCanvas = renderer.renderFrame(source, settings, 0, {
            preserveAlpha: format === 'png' || format === 'webp',
          });
          drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null);
          const outputCanvas = scaleCanvas(crtCanvas, scale);
          const blob = await exportCanvasImage(
            outputCanvas,
            format,
            exportConfig.imageQuality,
          );
          downloadBlob(blob, filename);
          renderer.destroy();
        } else if (format === 'gif') {
          if (!media.gifFrames) throw new Error('No animation frames to export');
          const blob = await exportGif(
            media.gifFrames,
            settings,
            textLayers,
            crtAffectText,
            setProgress,
            {
              scalePercent: exportConfig.scalePercent,
              gifQuality: exportConfig.gifQuality,
              frameSkip: exportConfig.frameSkip,
              dither: exportConfig.dither,
            },
          );
          downloadBlob(blob, filename);
        } else if (format === 'mp4' || format === 'webm') {
          if (!media.video) throw new Error('No video to export');
          const videoSettings = {
            scalePercent: exportConfig.scalePercent,
            frameSkip: exportConfig.frameSkip,
            optimizeVideo: exportConfig.optimizeVideo,
          };
          let blob: Blob;
          try {
            blob = await exportVideo(
              media.video,
              settings,
              textLayers,
              crtAffectText,
              format,
              setProgress,
              videoSettings,
            );
          } catch {
            blob = await exportVideoViaMediaRecorder(
              media.video,
              settings,
              textLayers,
              crtAffectText,
              setProgress,
              videoSettings,
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
