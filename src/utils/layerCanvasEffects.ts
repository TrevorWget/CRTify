import type { LayerEffect, TextLayer } from '../types/crt';
import { effectiveIntensity, effectClock, hash01 } from './layerEffects';

const bufferCanvas = document.createElement('canvas');
const bufferCtx = bufferCanvas.getContext('2d');
const tintCanvas = document.createElement('canvas');
const tintCtx = tintCanvas.getContext('2d');
const mashBuffers = new Map<string, HTMLCanvasElement>();

function prepareBuffer(source: HTMLCanvasElement) {
  if (!bufferCtx) return null;
  if (bufferCanvas.width !== source.width || bufferCanvas.height !== source.height) {
    bufferCanvas.width = source.width;
    bufferCanvas.height = source.height;
  }
  bufferCtx.clearRect(0, 0, source.width, source.height);
  bufferCtx.drawImage(source, 0, 0);
  return bufferCtx;
}

function effectStep(effect: LayerEffect, time: number, rate = 24) {
  return Math.floor((time * effect.speed + effect.phase) * rate);
}

function applyGlitch(canvas: HTMLCanvasElement, effect: LayerEffect, time: number, intensity: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const step = effectStep(effect, time, 18);
  const slices = Math.max(2, Math.round(3 + intensity * 12));
  const maxShift = canvas.width * 0.045 * intensity;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bufferCanvas, 0, 0);

  for (let index = 0; index < slices; index++) {
    const y = Math.floor(hash01(`${effect.id}:${step}:y:${index}`) * canvas.height);
    const h = Math.max(
      1,
      Math.floor((0.005 + hash01(`${effect.id}:${step}:h:${index}`) * 0.035) * canvas.height),
    );
    const shift = (hash01(`${effect.id}:${step}:x:${index}`) * 2 - 1) * maxShift;
    ctx.clearRect(0, y, canvas.width, h);
    ctx.drawImage(bufferCanvas, 0, y, canvas.width, h, shift, y, canvas.width, h);
  }
}

function applyStatic(canvas: HTMLCanvasElement, effect: LayerEffect, time: number, intensity: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const step = effectStep(effect, time, 30);
  const count = Math.round(50 + intensity * 500);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.15 + intensity * 0.5;
  for (let index = 0; index < count; index++) {
    const x = hash01(`${effect.id}:${step}:sx:${index}`) * canvas.width;
    const y = hash01(`${effect.id}:${step}:sy:${index}`) * canvas.height;
    const light = hash01(`${effect.id}:${step}:sl:${index}`) > 0.5;
    const size = 1 + hash01(`${effect.id}:${step}:ss:${index}`) * 2;
    ctx.fillStyle = light ? '#fff' : '#000';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function drawTintedSource(
  target: CanvasRenderingContext2D,
  color: string,
  offsetX: number,
  alpha: number,
) {
  if (!tintCtx) return;
  if (tintCanvas.width !== bufferCanvas.width || tintCanvas.height !== bufferCanvas.height) {
    tintCanvas.width = bufferCanvas.width;
    tintCanvas.height = bufferCanvas.height;
  }
  tintCtx.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
  tintCtx.drawImage(bufferCanvas, 0, 0);
  tintCtx.globalCompositeOperation = 'source-in';
  tintCtx.fillStyle = color;
  tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
  tintCtx.globalCompositeOperation = 'source-over';
  target.globalAlpha = alpha;
  target.drawImage(tintCanvas, offsetX, 0);
}

function applyRgbSplit(canvas: HTMLCanvasElement, effect: LayerEffect, time: number, intensity: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const phase = effectClock(effect, time) * Math.PI * 2;
  const offset = Math.sin(phase) * canvas.width * 0.018 * intensity;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'screen';
  drawTintedSource(ctx, '#ff2020', offset, 0.75);
  drawTintedSource(ctx, '#20ffff', -offset, 0.75);
  ctx.restore();
}

function applyEcho(canvas: HTMLCanvasElement, effect: LayerEffect, time: number, intensity: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const phase = effectClock(effect, time) * Math.PI * 2;
  const dx = Math.cos(phase) * canvas.width * 0.025 * intensity;
  const dy = Math.sin(phase) * canvas.height * 0.018 * intensity;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let copy = 3; copy >= 1; copy--) {
    ctx.globalAlpha = intensity * (0.16 / copy);
    ctx.drawImage(bufferCanvas, dx * copy, dy * copy);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(bufferCanvas, 0, 0);
  ctx.restore();
}

function applyTrackingTear(
  canvas: HTMLCanvasElement,
  effect: LayerEffect,
  time: number,
  intensity: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const step = effectStep(effect, time, 12);
  const bands = Math.max(1, Math.round(1 + intensity * 4));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bufferCanvas, 0, 0);
  for (let index = 0; index < bands; index++) {
    const y =
      ((hash01(`${effect.id}:${step}:ty:${index}`) + effectClock(effect, time)) % 1) * canvas.height;
    const h = Math.max(4, Math.round(canvas.height * (0.02 + intensity * 0.06)));
    const shift = (hash01(`${effect.id}:${step}:tx:${index}`) * 2 - 1) * canvas.width * 0.12 * intensity;
    ctx.clearRect(0, y, canvas.width, h);
    ctx.drawImage(bufferCanvas, 0, y, canvas.width, h, shift, y, canvas.width, h);
    ctx.fillStyle = `rgba(255,255,255,${0.04 * intensity})`;
    ctx.fillRect(0, y, canvas.width, 1);
  }
}

function applyDatamosh(
  canvas: HTMLCanvasElement,
  layer: TextLayer,
  effect: LayerEffect,
  time: number,
  intensity: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let mash = mashBuffers.get(layer.id);
  if (!mash) {
    mash = document.createElement('canvas');
    mashBuffers.set(layer.id, mash);
  }
  if (mash.width !== canvas.width || mash.height !== canvas.height) {
    mash.width = canvas.width;
    mash.height = canvas.height;
  }
  const mashCtx = mash.getContext('2d');
  if (!mashCtx) return;

  const hold = 0.35 + intensity * 0.55;
  const step = effectStep(effect, time, 8);
  const tearY = hash01(`${effect.id}:${step}:my`) * canvas.height;
  const tearH = canvas.height * (0.08 + intensity * 0.2);

  ctx.save();
  ctx.globalAlpha = hold;
  ctx.drawImage(mash, 0, tearY, canvas.width, tearH, 0, tearY, canvas.width, tearH);
  ctx.restore();

  mashCtx.clearRect(0, 0, mash.width, mash.height);
  mashCtx.drawImage(canvas, 0, 0);
}

function applyScanWipe(
  canvas: HTMLCanvasElement,
  effect: LayerEffect,
  time: number,
  intensity: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const clock = effectClock(effect, time);
  const wipe = clock * (1 + intensity * 0.25);
  const edge = wipe * (canvas.width + 40) - 20;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, Math.max(0, edge), canvas.height);
  ctx.clip();
  ctx.drawImage(bufferCanvas, 0, 0);
  ctx.restore();
  if (edge > 0 && edge < canvas.width) {
    ctx.fillStyle = `rgba(255, 244, 214, ${0.35 * intensity})`;
    ctx.fillRect(edge - 2, 0, 3, canvas.height);
  }
}

function applyColorCycle(
  canvas: HTMLCanvasElement,
  effect: LayerEffect,
  time: number,
  intensity: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const degrees = effectClock(effect, time) * 360 * (0.5 + intensity);
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `hue-rotate(${degrees}deg) saturate(${1 + intensity})`;
  ctx.globalAlpha = 0.65 + intensity * 0.35;
  ctx.drawImage(bufferCanvas, 0, 0);
  ctx.restore();
}

function applyFilmGrain(
  canvas: HTMLCanvasElement,
  effect: LayerEffect,
  time: number,
  intensity: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const step = effectStep(effect, time, 24);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const amount = 18 + intensity * 48;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const n =
      (hash01(`${effect.id}:${step}:g:${i}`) * 2 - 1) * amount * (0.35 + intensity * 0.65);
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
}

function applyChromaticPulse(
  canvas: HTMLCanvasElement,
  effect: LayerEffect,
  time: number,
  intensity: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const pulse = 0.35 + 0.65 * Math.abs(Math.sin(effectClock(effect, time) * Math.PI * 2));
  const offset = canvas.width * 0.022 * intensity * pulse;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'screen';
  drawTintedSource(ctx, '#ff3030', offset, 0.7);
  drawTintedSource(ctx, '#30ffff', -offset, 0.7);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1 - intensity * 0.25 * pulse;
  ctx.drawImage(bufferCanvas, 0, 0);
  ctx.restore();
}

function applyHoldTear(
  canvas: HTMLCanvasElement,
  effect: LayerEffect,
  time: number,
  intensity: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const clock = effectClock(effect, time);
  const bandY = ((clock + effect.phase) % 1) * canvas.height;
  const bandH = Math.max(12, Math.round(canvas.height * (0.08 + intensity * 0.22)));
  const shift = canvas.width * 0.18 * intensity;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bufferCanvas, 0, 0);
  ctx.clearRect(0, bandY, canvas.width, bandH);
  ctx.drawImage(bufferCanvas, 0, bandY, canvas.width, bandH, shift, bandY, canvas.width, bandH);
  ctx.fillStyle = `rgba(255,244,214,${0.08 + intensity * 0.12})`;
  ctx.fillRect(0, bandY, canvas.width, 2);
  ctx.fillRect(0, bandY + bandH - 2, canvas.width, 2);
}

const afterimageBuffers = new Map<string, HTMLCanvasElement>();

function applyAfterimage(
  canvas: HTMLCanvasElement,
  layer: TextLayer,
  _effect: LayerEffect,
  intensity: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let trail = afterimageBuffers.get(layer.id);
  if (!trail) {
    trail = document.createElement('canvas');
    afterimageBuffers.set(layer.id, trail);
  }
  if (trail.width !== canvas.width || trail.height !== canvas.height) {
    trail.width = canvas.width;
    trail.height = canvas.height;
  }
  const trailCtx = trail.getContext('2d');
  if (!trailCtx) return;

  ctx.save();
  ctx.globalAlpha = 0.2 + intensity * 0.55;
  ctx.drawImage(trail, 0, 0);
  ctx.restore();

  trailCtx.clearRect(0, 0, trail.width, trail.height);
  trailCtx.globalAlpha = 0.55 + intensity * 0.35;
  trailCtx.drawImage(canvas, 0, 0);
  trailCtx.globalAlpha = 1;
}

/** Apply deterministic pixel/compositing effects in list order. */
export function applyLayerCanvasEffects(
  canvas: HTMLCanvasElement,
  layer: TextLayer,
  time: number,
) {
  for (const effect of layer.effects ?? []) {
    const intensity = effectiveIntensity(effect, time);
    if (intensity <= 0) continue;
    switch (effect.kind) {
      case 'glitch':
        applyGlitch(canvas, effect, time, intensity);
        break;
      case 'static':
        applyStatic(canvas, effect, time, intensity);
        break;
      case 'rgbSplit':
        applyRgbSplit(canvas, effect, time, intensity);
        break;
      case 'echo':
        applyEcho(canvas, effect, time, intensity);
        break;
      case 'trackingTear':
        applyTrackingTear(canvas, effect, time, intensity);
        break;
      case 'datamosh':
        applyDatamosh(canvas, layer, effect, time, intensity);
        break;
      case 'scanWipe':
        applyScanWipe(canvas, effect, time, intensity);
        break;
      case 'colorCycle':
        applyColorCycle(canvas, effect, time, intensity);
        break;
      case 'filmGrain':
        applyFilmGrain(canvas, effect, time, intensity);
        break;
      case 'chromaticPulse':
        applyChromaticPulse(canvas, effect, time, intensity);
        break;
      case 'holdTear':
        applyHoldTear(canvas, effect, time, intensity);
        break;
      case 'afterimage':
        applyAfterimage(canvas, layer, effect, intensity);
        break;
    }
  }
}
