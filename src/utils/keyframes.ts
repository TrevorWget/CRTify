import type { LayerKeyframe, TextLayer } from '../types/crt';
import { applyLayerEffects } from './layerEffects';

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

function sortKeyframes(keyframes: LayerKeyframe[]): LayerKeyframe[] {
  return [...keyframes].sort((a, b) => a.t - b.t);
}

export function withKeyframeId(frame: LayerKeyframe): LayerKeyframe {
  return frame.id ? frame : { ...frame, id: crypto.randomUUID() };
}

/** Insert a keyframe, replacing any existing point at the same time. */
export function upsertKeyframe(
  keyframes: LayerKeyframe[],
  frame: LayerKeyframe,
): LayerKeyframe[] {
  const t = clamp01(frame.t);
  const replaced = keyframes.find((kf) => Math.abs(kf.t - t) <= KEYFRAME_EPSILON);
  const next = withKeyframeId({ ...frame, t, id: frame.id ?? replaced?.id });
  return sortKeyframes([...keyframes.filter((kf) => kf !== replaced), next]);
}

/** Patch one keyframe by id; `t` changes re-sort the list. */
export function updateKeyframe(
  keyframes: LayerKeyframe[],
  id: string,
  patch: Partial<LayerKeyframe>,
): LayerKeyframe[] {
  return sortKeyframes(
    keyframes.map((kf) => {
      if (kf.id !== id) return kf;
      const next = { ...kf, ...patch };
      return {
        ...next,
        t: clamp01(next.t),
        x: next.x === undefined ? undefined : clamp01(next.x),
        y: next.y === undefined ? undefined : clamp01(next.y),
        opacity: next.opacity === undefined ? undefined : clamp01(next.opacity),
      };
    }),
  );
}

export function removeKeyframe(keyframes: LayerKeyframe[], id: string): LayerKeyframe[] {
  return keyframes.filter((kf) => kf.id !== id);
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

/** Keyframe sample + transform-tier effects — used for draw, hit-test, and export. */
export function resolveLayerForRender(layer: TextLayer, time: number): TextLayer {
  return applyLayerEffects(resolveLayerAtTime(layer, time), time);
}

export function resolveLayersForRender(layers: TextLayer[], time: number): TextLayer[] {
  return layers.map((layer) => resolveLayerForRender(layer, time));
}

/**
 * Position edits must land on the authored (pre-effect) pose.
 * Invert the active effect delta so dragging / Center buttons match what the user sees.
 */
export function positionUpdate(
  layer: TextLayer,
  position: { x?: number; y?: number },
  time: number,
): Partial<TextLayer> {
  const keyed = resolveLayerAtTime(layer, time);
  const rendered = applyLayerEffects(keyed, time);
  const authoredX =
    position.x === undefined ? undefined : clamp01(position.x - (rendered.x - keyed.x));
  const authoredY =
    position.y === undefined ? undefined : clamp01(position.y - (rendered.y - keyed.y));

  if (!layer.keyframes.length) {
    return {
      ...(authoredX !== undefined ? { x: authoredX } : {}),
      ...(authoredY !== undefined ? { y: authoredY } : {}),
    };
  }

  const existing = findKeyframeAt(layer.keyframes, time);
  return {
    keyframes: upsertKeyframe(layer.keyframes, {
      t: time,
      x: authoredX ?? keyed.x,
      y: authoredY ?? keyed.y,
      opacity: existing?.opacity ?? keyed.opacity,
    }),
  };
}
