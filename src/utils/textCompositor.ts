import type { CrtSettings, TextLayer } from '../types/crt';
import { resolveLayerAtTime } from './keyframes';
import { drawShapeLayer } from './shapeDrawing';
import { CrtRenderer } from './webgl';

let textEffectRenderer: CrtRenderer | null = null;

const scratchCanvas = document.createElement('canvas');
const scratchCtx = scratchCanvas.getContext('2d');

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

function getFontStack(fontFamily: TextLayer['fontFamily']): string {
  return fontFamily === 'monospace' ? 'monospace' : `"${fontFamily}", monospace`;
}

function getLayerFilter(layer: TextLayer): string {
  const filters: string[] = [];
  if (layer.brightness !== 1) filters.push(`brightness(${layer.brightness})`);
  if (layer.blur > 0) filters.push(`blur(${layer.blur}px)`);
  return filters.length > 0 ? filters.join(' ') : 'none';
}

function getLines(layer: TextLayer): string[] {
  return (layer.text || '').split('\n');
}

function getLineWidth(ctx: CanvasRenderingContext2D, line: string, letterSpacing: number): number {
  if (!line) return 0;
  return ctx.measureText(line).width + Math.max(0, line.length - 1) * letterSpacing;
}

function getBlockSize(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  const lines = getLines(layer);
  const widths = lines.map((line) => getLineWidth(ctx, line, layer.letterSpacing));
  const width = Math.max(0, ...widths, 0);
  const height = Math.max(layer.fontSize, lines.length * layer.fontSize * layer.lineHeight);
  return { width, height, lines, widths };
}

function drawSpacedLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  letterSpacing: number,
  textAlign: TextLayer['textAlign'],
  totalWidth: number,
) {
  let cursor =
    textAlign === 'center' ? -totalWidth / 2 : textAlign === 'right' ? -totalWidth : 0;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    const characterWidth = ctx.measureText(character).width;
    if (ctx.lineWidth > 0) ctx.strokeText(character, cursor, 0);
    ctx.fillText(character, cursor, 0);
    cursor += characterWidth + letterSpacing;
  }
}

function drawTextBlock(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  const { lines, widths } = getBlockSize(ctx, layer);
  const blockHeight = lines.length * layer.fontSize * layer.lineHeight;
  lines.forEach((line, index) => {
    const y = -blockHeight / 2 + index * layer.fontSize * layer.lineHeight + layer.fontSize / 2;
    ctx.save();
    ctx.translate(0, y);
    drawSpacedLine(ctx, line, layer.letterSpacing, layer.textAlign, widths[index] || 0);
    ctx.restore();
  });
}

function drawImageLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, canvasW: number, canvasH: number) {
  const image = layer.imageElement;
  if (!image) return;
  const targetW = Math.max(8, canvasW * Math.abs(layer.scaleX));
  const targetH = Math.max(8, canvasH * Math.abs(layer.scaleY));
  if (layer.glow > 0) {
    ctx.shadowColor = layer.color;
    ctx.shadowBlur = layer.glow;
  }
  ctx.drawImage(image, -targetW / 2, -targetH / 2, targetW, targetH);
  if (layer.strokeWidth > 0) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = layer.strokeColor;
    ctx.lineWidth = layer.strokeWidth;
    ctx.strokeRect(-targetW / 2, -targetH / 2, targetW, targetH);
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
    rgbMask: 0,
    interlace: 0,
    rollBar: 0,
    phosphorDecay: 0,
    showBezel: false,
  };
}

function layerIsDrawable(layer: TextLayer): boolean {
  if (layer.kind === 'image') return Boolean(layer.imageElement || layer.imageUrl);
  if (layer.kind === 'shape') return true;
  return Boolean(layer.text.trim());
}

export function drawTextLayers(
  canvas: HTMLCanvasElement,
  layers: TextLayer[],
  settings: CrtSettings,
  crtAffectText: boolean,
  selectedLayerId: string | null,
  timeline = 0,
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

  for (const rawLayer of layers) {
    const layer = resolveLayerAtTime(rawLayer, timeline);
    if (!layerIsDrawable(layer)) continue;

    layerCtx.clearRect(0, 0, width, height);
    const x = layer.x * width;
    const y = layer.y * height;
    const font = `${layer.fontSize}px ${getFontStack(layer.fontFamily)}`;

    layerCtx.save();
    layerCtx.translate(x, y);
    layerCtx.rotate((layer.rotation * Math.PI) / 180);
    layerCtx.transform(1, 0, Math.tan((layer.skew * Math.PI) / 180), 1, 0, 0);
    if (layer.kind === 'text') {
      layerCtx.scale(layer.scaleX, layer.scaleY);
    }
    layerCtx.globalAlpha = layer.opacity;
    layerCtx.filter = getLayerFilter(layer);

    if (layer.kind === 'text') {
      layerCtx.font = font;
      layerCtx.textBaseline = 'middle';
      layerCtx.textAlign = 'left';
      if (layer.glow > 0) {
        layerCtx.shadowColor = layer.color;
        layerCtx.shadowBlur = layer.glow;
      }
      layerCtx.fillStyle = layer.color;
      layerCtx.strokeStyle = layer.strokeColor;
      layerCtx.lineWidth = layer.strokeWidth;
      layerCtx.lineJoin = 'round';
      drawTextBlock(layerCtx, layer);
    } else if (layer.kind === 'shape') {
      if (layer.glow > 0) {
        layerCtx.shadowColor = layer.color;
        layerCtx.shadowBlur = layer.glow;
      }
      drawShapeLayer(layerCtx, layer, width, height);
    } else if (layer.kind === 'image') {
      drawImageLayer(layerCtx, layer, width, height);
    }
    layerCtx.restore();

    const useWarp = crtAffectText || layer.warp > 0;
    if (useWarp) {
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
      ctx.strokeStyle = '#ffb000';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      if (layer.kind === 'text') {
        ctx.scale(layer.scaleX, layer.scaleY);
        ctx.font = font;
        const { width: textWidth, height: textHeight } = getBlockSize(ctx, layer);
        const startX =
          layer.textAlign === 'center'
            ? -textWidth / 2
            : layer.textAlign === 'right'
              ? -textWidth
              : 0;
        ctx.strokeRect(startX - 6, -textHeight / 2 - 6, textWidth + 12, textHeight + 12);
      } else {
        const w = width * Math.abs(layer.scaleX);
        const h = height * Math.abs(layer.scaleY);
        ctx.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
      }
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
    if (layer.locked || !layerIsDrawable(layer)) continue;

    const x = layer.x * canvasWidth;
    const y = layer.y * canvasHeight;
    const padding = Math.max(12, layer.glow, layer.blur * 2);

    if (layer.kind === 'text') {
      const font = `${layer.fontSize}px ${getFontStack(layer.fontFamily)}`;
      ctx.font = font;
      const { width: textWidth, height: textHeight } = getBlockSize(ctx, layer);
      const scaledW = textWidth * layer.scaleX;
      const scaledH = textHeight * (1 + layer.warp) * layer.scaleY;
      const startX =
        layer.textAlign === 'center'
          ? x - scaledW / 2
          : layer.textAlign === 'right'
            ? x - scaledW
            : x;
      if (
        px >= startX - padding &&
        px <= startX + scaledW + padding &&
        py >= y - scaledH / 2 - padding &&
        py <= y + scaledH / 2 + padding
      ) {
        return layer;
      }
    } else {
      const w = canvasWidth * Math.abs(layer.scaleX);
      const h = canvasHeight * Math.abs(layer.scaleY);
      if (
        px >= x - w / 2 - padding &&
        px <= x + w / 2 + padding &&
        py >= y - h / 2 - padding &&
        py <= y + h / 2 + padding
      ) {
        return layer;
      }
    }
  }
  return null;
}

export async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load overlay image'));
    image.src = url;
  });
}
