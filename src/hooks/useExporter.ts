import { useCallback, useState } from 'react';
import type {
  CrtSettings,
  ExportFormat,
  ExportOptionsConfig,
  ExportProgress,
  GifFrame,
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
import {
  canRecordFormat,
  exportVideo,
  exportVideoViaMediaRecorder,
} from '../utils/videoPipeline';
import { composeExportFrame } from '../utils/exportShared';
import { CrtRenderer } from '../utils/webgl';
import {
  getPreviewTime,
  getTimelinePosition,
  isFrameSequenceMedia,
} from '../utils/animationMedia';

interface ExportOptions {
  media: LoadedMedia;
  settings: CrtSettings;
  textLayers: TextLayer[];
  crtAffectText: boolean;
  gifFrameIndex: number;
  exportConfig: ExportOptionsConfig;
}

function currentStill(media: LoadedMedia, gifFrameIndex: number): TexImageSource | null {
  if (media.type === 'image' && media.image) return media.image;
  if (isFrameSequenceMedia(media) && media.gifFrames) {
    return media.gifFrames[gifFrameIndex % media.gifFrames.length].imageData;
  }
  if (media.type === 'video' && media.video) return media.video;
  return null;
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

        if (format === 'gif' && animated && media.gifFrames) {
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
          let frames: GifFrame[];
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
            const source = currentStill(media, gifFrameIndex);
            if (!source) throw new Error('No media to export');
            frames = await stillToLoopFrames(
              source,
              media.width,
              media.height,
              settings,
              textLayers,
              crtAffectText,
              settings.flicker ? 20 : 12,
            );
          }

          // Video frames are sampled at the requested scale; stills are rendered at source size.
          const scalePercent = media.type === 'video' ? 100 : exportConfig.scalePercent;
          if (format === 'gif') {
            downloadBlob(
              await exportGif(frames, settings, [], false, setProgress, {
                scalePercent,
                gifQuality: exportConfig.gifQuality,
                frameSkip: 1,
                dither: exportConfig.dither,
                preRendered: true,
              }),
              filename,
            );
          } else {
            downloadBlob(
              await exportAnimatedWebp(frames, settings, [], false, setProgress, {
                scalePercent,
                imageQuality: exportConfig.imageQuality,
                frameSkip: 1,
                preRendered: true,
              }),
              filename,
            );
          }
        } else if (format === 'png' || format === 'jpeg' || format === 'webp') {
          const source = currentStill(media, gifFrameIndex);
          if (!source) throw new Error('No media to export');

          const renderer = new CrtRenderer();
          try {
            const frame = composeExportFrame(
              renderer,
              source,
              settings,
              textLayers,
              crtAffectText,
              getPreviewTime(media, gifFrameIndex),
              getTimelinePosition(media, gifFrameIndex),
              format === 'png' || format === 'webp',
            );
            downloadBlob(
              await exportCanvasImage(scaleCanvas(frame, scale), format, exportConfig.imageQuality),
              filename,
            );
          } finally {
            renderer.destroy();
          }
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
            } catch (ffmpegError) {
              if (!canRecordFormat(format)) throw ffmpegError;
              console.warn('ffmpeg export failed; recording in real time instead', ffmpegError);
              setProgress({ stage: 'ffmpeg unavailable, recording without audio', progress: 0 });
              blob = await exportVideoViaMediaRecorder(
                media.video,
                settings,
                textLayers,
                crtAffectText,
                format,
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
            const frames = await stillToLoopFrames(
              media.image,
              media.width,
              media.height,
              settings,
              textLayers,
              crtAffectText,
              24,
            );
            blob = await exportFramesAsVideo(frames, settings, [], false, format, setProgress, {
              ...videoSettings,
              preRendered: true,
            });
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
