import type { CrtSettings, TextLayer } from '../types/crt';
import { CrtRenderer } from './webgl';

let textEffectRenderer: CrtRenderer | null = null;

const scratchCanvas = document.createElement('canvas');
const scratchCtx = scratchCanvas.getContext('2d');

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

function getFontStack(fontFamily: TextLayer['fontFamily']): string {
  return fontFamily === 'monospace' ? 'monospace' : `"${fontFamily}", monospace`;
}

// Canvas filters force a slow compositing path, so only opt in when a layer
// actually needs one.
function getLayerFilter(layer: TextLayer): string {
  const filters: string[] = [];
  if (layer.brightness !== 1) filters.push(`brightness(${layer.brightness})`);
  if (layer.blur > 0) filters.push(`blur(${layer.blur}px)`);
  return filters.length > 0 ? filters.join(' ') : 'none';
}

function getTextWidth(ctx: CanvasRenderingContext2D, layer: TextLayer): number {
  return ctx.measureText(layer.text).width + Math.max(0, layer.text.length - 1) * layer.letterSpacing;
}

function drawLayerText(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  const totalWidth = getTextWidth(ctx, layer);
  let cursor =
    layer.textAlign === 'center' ? -totalWidth / 2 : layer.textAlign === 'right' ? -totalWidth : 0;

  for (let index = 0; index < layer.text.length; index++) {
    const character = layer.text[index];
    const characterWidth = ctx.measureText(character).width;

    if (layer.strokeWidth > 0) {
      ctx.strokeText(character, cursor, 0);
    }
    ctx.fillText(character, cursor, 0);
    cursor += characterWidth + layer.letterSpacing;
  }
}

function getTextEffectSettings(
  settings: CrtSettings,
  curvature: number,
  applyCrtEffects: boolean,
): CrtSettings {
  if (applyCrtEffects) {
    return { ...settings, curvature };
  }

  return {
    ...settings,
    curvature,
    scanlineIntensity: 0,
    aberration: 0,
    vignette: 0,
    noise: 0,
    bloom: 0,
    tintStrength: 0,
    brightness: 1,
    contrast: 1,
    flicker: false,
  };
}

export function drawTextLayers(
  canvas: HTMLCanvasElement,
  layers: TextLayer[],
  settings: CrtSettings,
  crtAffectText: boolean,
  selectedLayerId: string | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !scratchCtx) return;

  const width = canvas.width;
  const height = canvas.height;

  const layerCanvas = scratchCanvas;
  const layerCtx = scratchCtx;
  if (layerCanvas.width !== width || layerCanvas.height !== height) {
    layerCanvas.width = width;
    layerCanvas.height = height;
  }

  for (const layer of layers) {
    if (!layer.text.trim()) continue;

    layerCtx.clearRect(0, 0, width, height);
    const x = layer.x * width;
    const y = layer.y * height;
    const font = `${layer.fontSize}px ${getFontStack(layer.fontFamily)}`;

    layerCtx.save();
    layerCtx.translate(x, y);
    layerCtx.rotate((layer.rotation * Math.PI) / 180);
    layerCtx.transform(1, 0, Math.tan((layer.skew * Math.PI) / 180), 1, 0, 0);
    layerCtx.scale(layer.scaleX, layer.scaleY);
    layerCtx.globalAlpha = layer.opacity;
    layerCtx.font = font;
    layerCtx.textBaseline = 'middle';
    layerCtx.textAlign = 'left';
    layerCtx.filter = getLayerFilter(layer);

    if (layer.glow > 0) {
      layerCtx.shadowColor = layer.color;
      layerCtx.shadowBlur = layer.glow;
    }

    layerCtx.fillStyle = layer.color;
    layerCtx.strokeStyle = layer.strokeColor;
    layerCtx.lineWidth = layer.strokeWidth;
    layerCtx.lineJoin = 'round';
    drawLayerText(layerCtx, layer);
    layerCtx.restore();

    if (crtAffectText || layer.warp > 0) {
      textEffectRenderer ??= new CrtRenderer();
      const effectSettings = getTextEffectSettings(settings, layer.warp, crtAffectText);
      const renderedLayer = textEffectRenderer.renderFrame(layerCanvas, effectSettings, 0, {
        preserveAlpha: true,
      });
      ctx.drawImage(renderedLayer, 0, 0);
    } else {
      ctx.drawImage(layerCanvas, 0, 0);
    }

    if (selectedLayerId === layer.id) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.transform(1, 0, Math.tan((layer.skew * Math.PI) / 180), 1, 0, 0);
      ctx.scale(layer.scaleX, layer.scaleY);
      ctx.font = font;
      const textWidth = getTextWidth(ctx, layer);
      const startX =
        layer.textAlign === 'center' ? -textWidth / 2 : layer.textAlign === 'right' ? -textWidth : 0;
      ctx.strokeStyle = '#ffb000';
      ctx.lineWidth = 2 / Math.max(layer.scaleX, layer.scaleY);
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        startX - 6,
        -layer.fontSize / 2 - 6,
        textWidth + 12,
        layer.fontSize + 12,
      );
      ctx.restore();
    }
  }
}

export function hitTestTextLayer(
  layers: TextLayer[],
  canvasWidth: number,
  canvasHeight: number,
  px: number,
  py: number,
): TextLayer | null {
  const ctx = measureCtx;
  if (!ctx) return null;

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.locked || !layer.text.trim()) continue;

    const x = layer.x * canvasWidth;
    const y = layer.y * canvasHeight;
    const font = `${layer.fontSize}px ${getFontStack(layer.fontFamily)}`;
    ctx.font = font;
    const textWidth = getTextWidth(ctx, layer) * layer.scaleX;
    const h = layer.fontSize * (1 + layer.warp) * layer.scaleY;
    const startX =
      layer.textAlign === 'center' ? x - textWidth / 2 : layer.textAlign === 'right' ? x - textWidth : x;
    const padding = Math.max(12, layer.glow, layer.blur * 2);

    if (
      px >= startX - padding &&
      px <= startX + textWidth + padding &&
      py >= y - h / 2 - padding &&
      py <= y + h / 2 + padding
    ) {
      return layer;
    }
  }
  return null;
}
