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
import {
  exportFramesAsVideo,
  rasterizeVideoToFrames,
  stillToLoopFrames,
} from '../utils/frameSequenceExport';
import { exportVideo, exportVideoViaMediaRecorder } from '../utils/videoPipeline';
import { applyBezelChrome } from '../utils/bezelOverlay';
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
        const animated = isFrameSequenceMedia(media);

        if (format === 'gif' && media.gifFrames) {
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
              rangeStart: exportConfig.rangeStart,
              rangeEnd: exportConfig.rangeEnd,
            },
          );
          downloadBlob(blob, filename);
        } else if (format === 'webp' && animated && media.gifFrames) {
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
              rangeStart: exportConfig.rangeStart,
              rangeEnd: exportConfig.rangeEnd,
            },
          );
          downloadBlob(blob, filename);
        } else if (format === 'gif' || (format === 'webp' && media.type === 'video')) {
          let frames;
          if (media.type === 'video' && media.video) {
            frames = await rasterizeVideoToFrames(
              media.video,
              settings,
              textLayers,
              crtAffectText,
              setProgress,
              {
                scalePercent: exportConfig.scalePercent,
                frameSkip: exportConfig.frameSkip,
                optimizeVideo: exportConfig.optimizeVideo,
                maxFrames: 240,
                rangeStart: exportConfig.rangeStart,
                rangeEnd: exportConfig.rangeEnd,
              },
            );
          } else {
            const source =
              media.type === 'image' && media.image
                ? media.image
                : media.gifFrames
                  ? imageDataToCanvas(
                      media.gifFrames[gifFrameIndex % media.gifFrames.length].imageData,
                    )
                  : null;
            if (!source) throw new Error('No media to export');
            frames = stillToLoopFrames(
              source,
              media.width,
              media.height,
              settings,
              textLayers,
              crtAffectText,
              settings.flicker ? 20 : 12,
            );
          }

          if (format === 'gif') {
            downloadBlob(
              await exportGif(frames, settings, [], false, setProgress, {
                scalePercent: 100,
                gifQuality: exportConfig.gifQuality,
                frameSkip: 1,
                dither: exportConfig.dither,
              }),
              filename,
            );
          } else {
            downloadBlob(
              await exportAnimatedWebp(frames, settings, [], false, setProgress, {
                scalePercent: 100,
                imageQuality: exportConfig.imageQuality,
                frameSkip: 1,
              }),
              filename,
            );
          }
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

          const timeline =
            media.type === 'video' && media.video && media.video.duration > 0
              ? media.video.currentTime / media.video.duration
              : media.gifFrames && media.gifFrames.length > 1
                ? gifFrameIndex / (media.gifFrames.length - 1)
                : 0;
          const crtCanvas = renderer.renderFrame(source, settings, 0, {
            preserveAlpha: format === 'png' || format === 'webp',
          });
          drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null, timeline);
          let output = scaleCanvas(crtCanvas, scale);
          if (settings.showBezel) output = applyBezelChrome(output);
          downloadBlob(
            await exportCanvasImage(output, format, exportConfig.imageQuality),
            filename,
          );
          renderer.destroy();
        } else if (format === 'mp4' || format === 'webm') {
          const videoSettings = {
            scalePercent: exportConfig.scalePercent,
            frameSkip: exportConfig.frameSkip,
            optimizeVideo: exportConfig.optimizeVideo,
            keepAudio: exportConfig.keepAudio,
            sourceFile: media.sourceFile,
            rangeStart: exportConfig.rangeStart,
            rangeEnd: exportConfig.rangeEnd,
          };
          let blob: Blob;
          if (media.video) {
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
          } else if (media.gifFrames) {
            blob = await exportFramesAsVideo(
              media.gifFrames,
              settings,
              textLayers,
              crtAffectText,
              format,
              setProgress,
              videoSettings,
            );
          } else if (media.image) {
            const frames = stillToLoopFrames(
              media.image,
              media.width,
              media.height,
              settings,
              textLayers,
              crtAffectText,
              24,
            );
            blob = await exportFramesAsVideo(
              frames,
              settings,
              [],
              false,
              format,
              setProgress,
              videoSettings,
            );
          } else {
            throw new Error('No media to export');
          }
          downloadBlob(blob, filename);
        }

        setProgress({ stage: 'Done', progress: 1 });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed';
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  return { exportMedia, exporting, progress, error, clearError: () => setError(null) };
}
