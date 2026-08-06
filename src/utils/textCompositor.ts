import type { CrtSettings, TextLayer } from '../types/crt';

function getFontStack(fontFamily: TextLayer['fontFamily']): string {
  switch (fontFamily) {
    case 'VT323':
      return '"VT323", monospace';
    case 'Press Start 2P':
      return '"Press Start 2P", monospace';
    default:
      return 'monospace';
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
    textCtx.globalAlpha = layer.opacity;
    textCtx.font = font;
    textCtx.textBaseline = 'top';

    if (layer.glow > 0) {
      textCtx.shadowColor = layer.color;
      textCtx.shadowBlur = layer.glow;
    }

    textCtx.fillStyle = layer.color;
    textCtx.fillText(layer.text, x, y);

    if (selectedLayerId === layer.id) {
      const metrics = textCtx.measureText(layer.text);
      textCtx.shadowBlur = 0;
      textCtx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
      textCtx.lineWidth = 1;
      textCtx.setLineDash([4, 4]);
      textCtx.strokeRect(x - 4, y - 4, metrics.width + 8, layer.fontSize + 8);
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
    const metrics = ctx.measureText(layer.text);
    const w = metrics.width + 8;
    const h = layer.fontSize + 8;

    if (px >= x - 4 && px <= x - 4 + w && py >= y - 4 && py <= y - 4 + h) {
      return layer;
    }
  }
  return null;
}
