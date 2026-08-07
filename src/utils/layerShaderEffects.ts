import type { TextLayer } from '../types/crt';
import { effectiveIntensity, effectClock } from './layerEffects';
import type { LayerDistortionOptions } from './webgl';

const SHADER_KINDS: Array<keyof LayerDistortionOptions> = [
  'wave',
  'ripple',
  'bulge',
  'shimmer',
];

export function getLayerDistortionOptions(
  layer: TextLayer,
  time: number,
): LayerDistortionOptions {
  const result: LayerDistortionOptions = {};
  for (const kind of SHADER_KINDS) {
    const effects = (layer.effects ?? []).filter((effect) => effect.kind === kind);
    const weighted = effects
      .map((effect) => ({
        effect,
        weight: effectiveIntensity(effect, time),
      }))
      .filter((item) => item.weight > 0);
    if (!weighted.length) continue;
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    result[kind] = {
      amount: Math.min(1, total),
      speed:
        weighted.reduce((sum, item) => sum + item.effect.speed * item.weight, 0) / total,
      phase:
        weighted.reduce((sum, item) => sum + item.effect.phase * item.weight, 0) / total,
    };
  }
  return result;
}

export function hasLayerDistortion(layer: TextLayer, time: number): boolean {
  return Object.keys(getLayerDistortionOptions(layer, time)).length > 0;
}

/** @deprecated Prefer getLayerDistortionOptions(layer, time). */
export function getLayerDistortionClockPhase(layer: TextLayer, time: number) {
  for (const kind of SHADER_KINDS) {
    const effect = (layer.effects ?? []).find((item) => item.kind === kind);
    if (effect) return effectClock(effect, time);
  }
  return time;
}
