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
