import type { CrtSettings, TextLayer } from '../types/crt';

function getFontStack(fontFamily: TextLayer['fontFamily']): string {
  return fontFamily === 'monospace' ? 'monospace' : `"${fontFamily}", monospace`;
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
    const phase = layer.text.length > 1 ? index / (layer.text.length - 1) : 0;
    const warpOffset = Math.sin(phase * Math.PI * 2) * layer.warp * layer.fontSize * 0.5;

    if (layer.strokeWidth > 0) {
      ctx.strokeText(character, cursor, warpOffset);
    }
    ctx.fillText(character, cursor, warpOffset);
    cursor += characterWidth + layer.letterSpacing;
  }
}

function applyCrtToText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: CrtSettings,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const scanlineCount = settings.scanlineCount;

  for (let y = 0; y < height; y++) {
    const scanline = Math.sin((y / height) * scanlineCount * Math.PI) * 0.5 + 0.5;
    const factor = 1.0 - settings.scanlineIntensity * 0.5 * (1.0 - scanline);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 0) {
        data[i] = Math.min(255, data[i] * factor);
        data[i + 1] = Math.min(255, data[i + 1] * factor);
        data[i + 2] = Math.min(255, data[i + 2] * factor);
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export function drawTextLayers(
  canvas: HTMLCanvasElement,
  layers: TextLayer[],
  settings: CrtSettings,
  crtAffectText: boolean,
  selectedLayerId: string | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  const textCanvas = document.createElement('canvas');
  textCanvas.width = width;
  textCanvas.height = height;
  const textCtx = textCanvas.getContext('2d');
  if (!textCtx) return;

  for (const layer of layers) {
    if (!layer.text.trim()) continue;

    const x = layer.x * width;
    const y = layer.y * height;
    const font = `${layer.fontSize}px ${getFontStack(layer.fontFamily)}`;

    textCtx.save();
    textCtx.translate(x, y);
    textCtx.rotate((layer.rotation * Math.PI) / 180);
    textCtx.transform(1, 0, Math.tan((layer.skew * Math.PI) / 180), 1, 0, 0);
    textCtx.scale(layer.scaleX, layer.scaleY);
    textCtx.globalAlpha = layer.opacity;
    textCtx.font = font;
    textCtx.textBaseline = 'middle';
    textCtx.textAlign = 'left';
    textCtx.filter = layer.blur > 0 ? `blur(${layer.blur}px)` : 'none';

    if (layer.glow > 0) {
      textCtx.shadowColor = layer.color;
      textCtx.shadowBlur = layer.glow;
    }

    textCtx.fillStyle = layer.color;
    textCtx.strokeStyle = layer.strokeColor;
    textCtx.lineWidth = layer.strokeWidth;
    textCtx.lineJoin = 'round';
    drawLayerText(textCtx, layer);

    if (selectedLayerId === layer.id) {
      const textWidth = getTextWidth(textCtx, layer);
      const startX =
        layer.textAlign === 'center' ? -textWidth / 2 : layer.textAlign === 'right' ? -textWidth : 0;
      textCtx.shadowBlur = 0;
      textCtx.filter = 'none';
      textCtx.strokeStyle = '#ffb000';
      textCtx.lineWidth = 2 / Math.max(layer.scaleX, layer.scaleY);
      textCtx.setLineDash([4, 4]);
      textCtx.strokeRect(
        startX - 6,
        -layer.fontSize / 2 - layer.warp * layer.fontSize * 0.5 - 6,
        textWidth + 12,
        layer.fontSize * (1 + layer.warp) + 12,
      );
    }

    textCtx.restore();
  }

  if (crtAffectText) {
    applyCrtToText(textCtx, width, height, settings);
  }

  ctx.drawImage(textCanvas, 0, 0);
}

export function hitTestTextLayer(
  layers: TextLayer[],
  canvasWidth: number,
  canvasHeight: number,
  px: number,
  py: number,
): TextLayer | null {
  const measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
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
