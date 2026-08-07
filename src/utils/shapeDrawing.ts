import type { ShapeKind, TextLayer } from '../types/crt';

function fillAndStroke(ctx: CanvasRenderingContext2D, strokeWidth: number) {
  ctx.fill();
  if (strokeWidth > 0) ctx.stroke();
}

function drawStarPath(ctx: CanvasRenderingContext2D, outerR: number, innerR: number, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 2) * -1 + (i * Math.PI) / points;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHeartPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const top = -h * 0.35;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.35);
  ctx.bezierCurveTo(w * 0.5, h * 0.05, w * 0.55, top, 0, top + h * 0.2);
  ctx.bezierCurveTo(-w * 0.55, top, -w * 0.5, h * 0.05, 0, h * 0.35);
  ctx.closePath();
}

function drawChevronPair(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  direction: 1 | -1,
) {
  const spread = w * 0.22;
  const tip = w * 0.42 * direction;
  const mid = w * 0.05 * direction;

  const drawOne = (offset: number) => {
    ctx.beginPath();
    ctx.moveTo(mid - tip * 0.35 - offset, -h / 2);
    ctx.lineTo(tip - offset, 0);
    ctx.lineTo(mid - tip * 0.35 - offset, h / 2);
    ctx.lineTo(mid - tip * 0.35 - spread * 0.4 - offset, h / 2);
    ctx.lineTo(tip - spread - offset, 0);
    ctx.lineTo(mid - tip * 0.35 - spread * 0.4 - offset, -h / 2);
    ctx.closePath();
    ctx.fill();
    if (ctx.lineWidth > 0) ctx.stroke();
  };

  drawOne(0);
  drawOne(spread);
}

function drawSpeechPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rx = w * 0.45;
  const ry = h * 0.3;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.1, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ctx.lineWidth > 0) ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-rx * 0.15, ry * 0.35);
  ctx.lineTo(-rx * 0.05, h * 0.48);
  ctx.lineTo(rx * 0.28, ry * 0.2);
  ctx.closePath();
  ctx.fill();
  if (ctx.lineWidth > 0) ctx.stroke();
}

function drawPlusPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const t = Math.min(w, h) * 0.18;
  ctx.beginPath();
  ctx.moveTo(-t, -h / 2);
  ctx.lineTo(t, -h / 2);
  ctx.lineTo(t, -t);
  ctx.lineTo(w / 2, -t);
  ctx.lineTo(w / 2, t);
  ctx.lineTo(t, t);
  ctx.lineTo(t, h / 2);
  ctx.lineTo(-t, h / 2);
  ctx.lineTo(-t, t);
  ctx.lineTo(-w / 2, t);
  ctx.lineTo(-w / 2, -t);
  ctx.lineTo(-t, -t);
  ctx.closePath();
}

function drawArrowPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.2);
  ctx.lineTo(w * 0.15, -h * 0.2);
  ctx.lineTo(w * 0.15, -h / 2);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(w * 0.15, h / 2);
  ctx.lineTo(w * 0.15, h * 0.2);
  ctx.lineTo(-w / 2, h * 0.2);
  ctx.closePath();
}

function drawHexagonPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = Math.cos(angle) * (w / 2);
    const y = Math.sin(angle) * (h / 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Draw a centered shape in local layer coordinates. */
export function drawShapePath(
  ctx: CanvasRenderingContext2D,
  shape: ShapeKind,
  w: number,
  h: number,
  strokeWidth: number,
) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (shape) {
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      fillAndStroke(ctx, strokeWidth);
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      fillAndStroke(ctx, strokeWidth);
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(0, h / 2);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      fillAndStroke(ctx, strokeWidth);
      break;
    case 'hexagon':
      drawHexagonPath(ctx, w, h);
      fillAndStroke(ctx, strokeWidth);
      break;
    case 'star':
      drawStarPath(ctx, Math.min(w, h) / 2, Math.min(w, h) / 4.5);
      fillAndStroke(ctx, strokeWidth);
      break;
    case 'heart':
      drawHeartPath(ctx, w, h);
      fillAndStroke(ctx, strokeWidth);
      break;
    case 'plus':
      drawPlusPath(ctx, w, h);
      fillAndStroke(ctx, strokeWidth);
      break;
    case 'arrow':
      drawArrowPath(ctx, w, h);
      fillAndStroke(ctx, strokeWidth);
      break;
    case 'speech':
      drawSpeechPath(ctx, w, h);
      break;
    case 'rewind':
      drawChevronPair(ctx, w, h, -1);
      break;
    case 'fastforward':
      drawChevronPair(ctx, w, h, 1);
      break;
    case 'rect':
    default:
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      fillAndStroke(ctx, strokeWidth);
      break;
  }
}

export function drawShapeLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  canvasWidth: number,
  canvasHeight: number,
) {
  const w = Math.max(8, canvasWidth * Math.abs(layer.scaleX));
  const h = Math.max(8, canvasHeight * Math.abs(layer.scaleY));
  ctx.fillStyle = layer.color;
  ctx.strokeStyle = layer.strokeColor;
  ctx.lineWidth = layer.strokeWidth;
  drawShapePath(ctx, layer.shape ?? 'rect', w, h, layer.strokeWidth);
}
