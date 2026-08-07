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
