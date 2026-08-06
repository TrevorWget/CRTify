import GIF from 'gif.js';
import type { CrtSettings, ExportProgress, GifFrame, TextLayer } from '../types/crt';
import { CrtRenderer } from './webgl';
import { drawTextLayers } from './textCompositor';
import { imageDataToCanvas } from './mediaLoader';

const frameCanvas = document.createElement('canvas');
const frameCtx = frameCanvas.getContext('2d')!;
const encodeCanvas = document.createElement('canvas');
const encodeCtx = encodeCanvas.getContext('2d')!;
const GIF_TRANSPARENT_COLOR = 0x01fe01;

export async function exportGif(
  frames: GifFrame[],
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  onProgress: (progress: ExportProgress) => void,
): Promise<Blob> {
  const renderer = new CrtRenderer();
  const width = frames[0].imageData.width;
  const height = frames[0].imageData.height;

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width,
      height,
      // gif.js expects a numeric RGB value at runtime; its community typings
      // incorrectly declare this option as a string.
      transparent: GIF_TRANSPARENT_COLOR as unknown as string,
      workerScript: `${import.meta.env.BASE_URL}gif.worker.js`,
    });

    gif.on('finished', (blob: Blob) => {
      renderer.destroy();
      resolve(blob);
    });

    gif.on('progress', (p: number) => {
      onProgress({ stage: 'Encoding GIF', progress: 0.5 + p * 0.5 });
    });

    (async () => {
      try {
        for (let i = 0; i < frames.length; i++) {
          onProgress({
            stage: `Processing frame ${i + 1}/${frames.length}`,
            progress: (i / frames.length) * 0.5,
          });

          frameCanvas.width = width;
          frameCanvas.height = height;
          frameCtx.putImageData(frames[i].imageData, 0, 0);

          const time = i * 0.1;
          const crtCanvas = renderer.renderFrame(frameCanvas, settings, time, {
            preserveAlpha: true,
          });
          drawTextLayers(crtCanvas, textLayers, settings, crtAffectText, null);

          encodeCanvas.width = width;
          encodeCanvas.height = height;
          encodeCtx.fillStyle = '#01fe01';
          encodeCtx.fillRect(0, 0, width, height);
          encodeCtx.drawImage(crtCanvas, 0, 0);

          gif.addFrame(encodeCanvas, { copy: true, delay: frames[i].delay });
        }
        gif.render();
      } catch (err) {
        renderer.destroy();
        reject(err);
      }
    })();
  });
}

export function framesToCanvases(frames: GifFrame[]): HTMLCanvasElement[] {
  return frames.map((f) => imageDataToCanvas(f.imageData));
}
