import type { LayerEffect, TextLayer } from '../types/crt';
import { hash01 } from './layerEffects';

const bufferCanvas = document.createElement('canvas');
const bufferCtx = bufferCanvas.getContext('2d');
const tintCanvas = document.createElement('canvas');
const tintCtx = tintCanvas.getContext('2d');

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

function applyGlitch(canvas: HTMLCanvasElement, effect: LayerEffect, time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const step = effectStep(effect, time, 18);
  const slices = Math.max(2, Math.round(3 + effect.intensity * 12));
  const maxShift = canvas.width * 0.045 * effect.intensity;
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

function applyStatic(canvas: HTMLCanvasElement, effect: LayerEffect, time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const step = effectStep(effect, time, 30);
  const count = Math.round(50 + effect.intensity * 500);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.15 + effect.intensity * 0.5;
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

function applyRgbSplit(canvas: HTMLCanvasElement, effect: LayerEffect, time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const phase = (time * effect.speed + effect.phase) * Math.PI * 2;
  const offset = Math.sin(phase) * canvas.width * 0.018 * effect.intensity;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'screen';
  drawTintedSource(ctx, '#ff2020', offset, 0.75);
  drawTintedSource(ctx, '#20ffff', -offset, 0.75);
  ctx.restore();
}

function applyEcho(canvas: HTMLCanvasElement, effect: LayerEffect, time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !prepareBuffer(canvas)) return;
  const phase = (time * effect.speed + effect.phase) * Math.PI * 2;
  const dx = Math.cos(phase) * canvas.width * 0.025 * effect.intensity;
  const dy = Math.sin(phase) * canvas.height * 0.018 * effect.intensity;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let copy = 3; copy >= 1; copy--) {
    ctx.globalAlpha = effect.intensity * (0.16 / copy);
    ctx.drawImage(bufferCanvas, dx * copy, dy * copy);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(bufferCanvas, 0, 0);
  ctx.restore();
}

/** Apply deterministic pixel/compositing effects in list order. */
export function applyLayerCanvasEffects(
  canvas: HTMLCanvasElement,
  layer: TextLayer,
  time: number,
) {
  for (const effect of layer.effects ?? []) {
    if (!effect.enabled || effect.intensity <= 0) continue;
    switch (effect.kind) {
      case 'glitch':
        applyGlitch(canvas, effect, time);
        break;
      case 'static':
        applyStatic(canvas, effect, time);
        break;
      case 'rgbSplit':
        applyRgbSplit(canvas, effect, time);
        break;
      case 'echo':
        applyEcho(canvas, effect, time);
        break;
    }
  }
}
