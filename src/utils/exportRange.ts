/** Shared helpers for export in/out range (normalized 0–1). */

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function normalizeExportRange(rangeStart = 0, rangeEnd = 1): { start: number; end: number } {
  const start = clamp01(rangeStart);
  const end = Math.max(start, clamp01(rangeEnd));
  return { start, end };
}

/** Pick frame indexes within a normalized in/out window, stepping by frameSkip. */
export function selectFrameIndexes(
  frameCount: number,
  frameSkip: number,
  rangeStart = 0,
  rangeEnd = 1,
): number[] {
  if (frameCount <= 0) return [];
  if (frameCount === 1) return [0];

  const { start, end } = normalizeExportRange(rangeStart, rangeEnd);
  const startIdx = Math.floor(start * (frameCount - 1));
  const endIdx = Math.max(startIdx, Math.ceil(end * (frameCount - 1)));
  const skip = Math.max(1, Math.round(frameSkip));
  const indexes: number[] = [];
  for (let i = startIdx; i <= endIdx; i += skip) indexes.push(i);
  if (indexes[indexes.length - 1] !== endIdx) indexes.push(endIdx);
  return indexes;
}

/** Map a selected source frame index to a 0–1 timeline position. */
export function frameIndexToTimeline(index: number, frameCount: number): number {
  if (frameCount <= 1) return 0;
  return clamp01(index / (frameCount - 1));
}
