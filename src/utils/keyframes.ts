import type { LayerKeyframe, TextLayer } from '../types/crt';

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sampleChannel(
  keyframes: LayerKeyframe[],
  time: number,
  channel: 'x' | 'y' | 'opacity',
  fallback: number,
): number {
  const points = keyframes
    .filter((frame) => typeof frame[channel] === 'number')
    .map((frame) => ({ t: clamp01(frame.t), value: frame[channel] as number }))
    .sort((a, b) => a.t - b.t);

  if (points.length === 0) return fallback;
  if (time <= points[0].t) return points[0].value;
  if (time >= points[points.length - 1].t) return points[points.length - 1].value;

  for (let i = 0; i < points.length - 1; i++) {
    const left = points[i];
    const right = points[i + 1];
    if (time >= left.t && time <= right.t) {
      const local = (time - left.t) / Math.max(0.0001, right.t - left.t);
      return lerp(left.value, right.value, local);
    }
  }

  return fallback;
}

/** Two keyframes closer than this on the timeline are treated as the same point. */
export const KEYFRAME_EPSILON = 0.001;

/** Insert a keyframe, replacing any existing point at the same time. */
export function upsertKeyframe(
  keyframes: LayerKeyframe[],
  frame: LayerKeyframe,
): LayerKeyframe[] {
  const t = clamp01(frame.t);
  return [...keyframes.filter((kf) => Math.abs(kf.t - t) > KEYFRAME_EPSILON), { ...frame, t }].sort(
    (a, b) => a.t - b.t,
  );
}

export function findKeyframeAt(
  keyframes: LayerKeyframe[],
  time: number,
): LayerKeyframe | undefined {
  const t = clamp01(time);
  return keyframes.find((kf) => Math.abs(kf.t - t) <= KEYFRAME_EPSILON);
}

/** Apply lightweight opacity/position keyframes at normalized time t (0–1). */
export function resolveLayerAtTime(layer: TextLayer, time: number): TextLayer {
  if (!layer.keyframes.length) return layer;
  const t = clamp01(time);
  return {
    ...layer,
    x: sampleChannel(layer.keyframes, t, 'x', layer.x),
    y: sampleChannel(layer.keyframes, t, 'y', layer.y),
    opacity: sampleChannel(layer.keyframes, t, 'opacity', layer.opacity),
  };
}

export function resolveLayersAtTime(layers: TextLayer[], time: number): TextLayer[] {
  return layers.map((layer) => resolveLayerAtTime(layer, time));
}

/**
 * Position edits on a keyframed layer must land on the keyframe at the playhead,
 * otherwise the sampled animation keeps overriding the new base position.
 */
export function positionUpdate(
  layer: TextLayer,
  position: { x?: number; y?: number },
  time: number,
): Partial<TextLayer> {
  if (!layer.keyframes.length) return position;

  const resolved = resolveLayerAtTime(layer, time);
  const existing = findKeyframeAt(layer.keyframes, time);
  return {
    keyframes: upsertKeyframe(layer.keyframes, {
      t: time,
      x: position.x ?? resolved.x,
      y: position.y ?? resolved.y,
      opacity: existing?.opacity ?? resolved.opacity,
    }),
  };
}
