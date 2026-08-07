import type { TextLayer } from '../types/crt';
import type { LayerDistortionOptions } from './webgl';

const SHADER_KINDS: Array<keyof LayerDistortionOptions> = [
  'wave',
  'ripple',
  'bulge',
  'shimmer',
];

export function getLayerDistortionOptions(layer: TextLayer): LayerDistortionOptions {
  const result: LayerDistortionOptions = {};
  for (const kind of SHADER_KINDS) {
    const effects = (layer.effects ?? []).filter(
      (effect) => effect.kind === kind && effect.enabled && effect.intensity > 0,
    );
    if (!effects.length) continue;
    const total = effects.reduce((sum, effect) => sum + effect.intensity, 0);
    result[kind] = {
      amount: Math.min(1, total),
      speed: effects.reduce((sum, effect) => sum + effect.speed * effect.intensity, 0) / total,
      phase: effects.reduce((sum, effect) => sum + effect.phase * effect.intensity, 0) / total,
    };
  }
  return result;
}

export function hasLayerDistortion(layer: TextLayer): boolean {
  return Object.keys(getLayerDistortionOptions(layer)).length > 0;
}
