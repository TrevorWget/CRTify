/** Draw a chunky cassette-futurist TV chrome bezel around a rendered frame. */
export function applyBezelChrome(source: HTMLCanvasElement): HTMLCanvasElement {
  const padX = Math.max(18, Math.round(source.width * 0.08));
  const padY = Math.max(22, Math.round(source.height * 0.1));
  const width = source.width + padX * 2;
  const height = source.height + padY * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;

  const chassis = ctx.createLinearGradient(0, 0, width, height);
  chassis.addColorStop(0, '#f0e4c8');
  chassis.addColorStop(0.45, '#d7c7a5');
  chassis.addColorStop(1, '#b9a888');
  ctx.fillStyle = chassis;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#5c4a32';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.008));
  ctx.strokeRect(4, 4, width - 8, height - 8);

  // Inner recess
  ctx.fillStyle = '#17120d';
  ctx.fillRect(padX - 8, padY - 8, source.width + 16, source.height + 16);
  ctx.strokeStyle = '#3d2f20';
  ctx.strokeRect(padX - 8, padY - 8, source.width + 16, source.height + 16);

  ctx.drawImage(source, padX, padY);

  // Corner screws
  const screwR = Math.max(3, Math.round(Math.min(padX, padY) * 0.18));
  for (const [x, y] of [
    [12, 12],
    [width - 12, 12],
    [12, height - 12],
    [width - 12, height - 12],
  ] as const) {
    ctx.beginPath();
    ctx.fillStyle = '#a79374';
    ctx.arc(x, y, screwR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a4833';
    ctx.beginPath();
    ctx.moveTo(x - screwR * 0.6, y);
    ctx.lineTo(x + screwR * 0.6, y);
    ctx.moveTo(x, y - screwR * 0.6);
    ctx.lineTo(x, y + screwR * 0.6);
    ctx.stroke();
  }

  // Brand plate
  const plateH = Math.max(14, Math.round(padY * 0.45));
  ctx.fillStyle = '#d62818';
  ctx.fillRect(padX, Math.max(6, padY * 0.28 - plateH / 2), Math.min(160, source.width * 0.4), plateH);
  ctx.fillStyle = '#fff4d6';
  ctx.font = `bold ${Math.max(9, Math.round(plateH * 0.55))}px "Share Tech Mono", monospace`;
  ctx.fillText('CRTIFY MONITOR', padX + 8, Math.max(6, padY * 0.28 - plateH / 2) + plateH * 0.72);

  // Power LED
  ctx.beginPath();
  ctx.fillStyle = '#d62818';
  ctx.arc(padX + 10, height - Math.max(10, padY * 0.35), Math.max(3, screwR * 0.7), 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}
