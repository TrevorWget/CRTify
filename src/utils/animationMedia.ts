import type { LoadedMedia } from '../types/crt';

/** GIF or animated WebP with decoded frame sequence. */
export function isFrameSequenceMedia(media: LoadedMedia | null | undefined): boolean {
  return (
    !!media &&
    (media.type === 'gif' || media.type === 'webp') &&
    Array.isArray(media.gifFrames) &&
    media.gifFrames.length > 0
  );
}

export function isPlayableMedia(media: LoadedMedia | null | undefined): boolean {
  return isFrameSequenceMedia(media) || media?.type === 'video';
}

/** Normalized playhead position (0–1) used to sample layer keyframes. */
export function getTimelinePosition(
  media: LoadedMedia | null | undefined,
  gifFrameIndex: number,
  videoTime?: number,
): number {
  if (!media) return 0;
  if (isFrameSequenceMedia(media) && media.gifFrames) {
    return gifFrameIndex / Math.max(1, media.gifFrames.length - 1);
  }
  if (media.type === 'video' && media.video) {
    const duration = media.video.duration;
    const current = videoTime ?? media.video.currentTime;
    return duration > 0 ? current / duration : 0;
  }
  return 0;
}
