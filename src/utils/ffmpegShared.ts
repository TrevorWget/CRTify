import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { getVideoCrf } from './imageExport';

const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
/** ffmpeg.wasm keeps its virtual filesystem inside wasm memory, which tops out near 2 GB. */
export const MAX_FFMPEG_INPUT_BYTES = 1024 * 1024 * 1024;
const WORKSPACE_FILE = /^(frame\d{5}\.jpg|source\.\w+|output\.\w+)$/;

let ffmpegPromise: Promise<FFmpeg> | null = null;

export function getFFmpeg(): Promise<FFmpeg> {
  ffmpegPromise ??= (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
  })().catch((err: unknown) => {
    ffmpegPromise = null;
    throw err;
  });
  return ffmpegPromise;
}

/** Thrown when ffmpeg.wasm itself aborts; the instance is unusable afterwards. */
export class FfmpegCrashError extends Error {}

function discardFFmpeg() {
  const current = ffmpegPromise;
  ffmpegPromise = null;
  current?.then((ffmpeg) => ffmpeg.terminate()).catch(() => undefined);
}

/**
 * Run an export against a clean ffmpeg workspace. A wasm crash poisons the
 * shared instance, so it is discarded and the next export loads a fresh one.
 */
export async function runFfmpegJob<T>(job: (ffmpeg: FFmpeg) => Promise<T>): Promise<T> {
  const ffmpeg = await getFFmpeg();
  let crashed = false;
  try {
    await clearFfmpegWorkspace(ffmpeg);
    return await job(ffmpeg);
  } catch (err) {
    if (err instanceof FfmpegCrashError) {
      crashed = true;
      discardFFmpeg();
    }
    throw err;
  } finally {
    if (!crashed) await clearFfmpegWorkspace(ffmpeg).catch(() => undefined);
  }
}

/**
 * Remove frames and outputs left by earlier exports. `frame%05d.jpg` input reads
 * until the numbering breaks, so stale frames would otherwise be appended.
 */
export async function clearFfmpegWorkspace(ffmpeg: FFmpeg) {
  const entries = await ffmpeg.listDir('/');
  for (const entry of entries) {
    if (!entry.isDir && WORKSPACE_FILE.test(entry.name)) {
      await ffmpeg.deleteFile(entry.name).catch(() => undefined);
    }
  }
}

export interface FrameSink {
  write: (jpegBytes: Uint8Array) => Promise<void>;
  readonly count: number;
}

export function createFrameSink(ffmpeg: FFmpeg): FrameSink {
  let count = 0;
  let bytes = 0;
  return {
    async write(jpegBytes) {
      bytes += jpegBytes.byteLength;
      if (bytes > MAX_FFMPEG_INPUT_BYTES) {
        throw new Error(
          'This export is too large to encode in the browser. Lower the resolution scale or keep fewer frames.',
        );
      }
      await ffmpeg.writeFile(`frame${String(count).padStart(5, '0')}.jpg`, jpegBytes);
      count++;
    },
    get count() {
      return count;
    },
  };
}

interface EncodeOptions {
  format: 'mp4' | 'webm';
  fps: number;
  optimize: boolean;
  /** Source media whose first audio stream is muxed into the output. */
  audioSource?: File;
}

/** Encode the frames written through a FrameSink into an MP4/WebM blob. */
export async function encodeFrameSequence(ffmpeg: FFmpeg, options: EncodeOptions): Promise<Blob> {
  const { format, fps, optimize, audioSource } = options;
  const args = ['-framerate', String(fps), '-i', 'frame%05d.jpg'];

  if (audioSource) {
    const ext = /\.([a-z0-9]+)$/i.exec(audioSource.name)?.[1]?.toLowerCase() ?? 'bin';
    const sourceName = `source.${ext}`;
    await ffmpeg.writeFile(sourceName, new Uint8Array(await audioSource.arrayBuffer()));
    args.push('-i', sourceName, '-map', '0:v:0', '-map', '1:a:0?');
  }

  const crf = String(getVideoCrf(optimize, format));
  if (format === 'mp4') {
    args.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', crf,
      '-preset', optimize ? 'veryfast' : 'medium',
    );
  } else {
    args.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', crf);
  }
  if (audioSource) {
    args.push('-c:a', format === 'mp4' ? 'aac' : 'libopus', '-shortest');
  }
  args.push('-y', `output.${format}`);

  let exitCode: number;
  try {
    exitCode = await ffmpeg.exec(args);
  } catch (err) {
    throw new FfmpegCrashError(`ffmpeg crashed while encoding ${format.toUpperCase()}`, { cause: err });
  }
  if (exitCode !== 0) throw new Error(`ffmpeg exited with code ${exitCode}`);

  const outputData = await ffmpeg.readFile(`output.${format}`);
  const bytes =
    outputData instanceof Uint8Array
      ? new Uint8Array(outputData)
      : new TextEncoder().encode(outputData);
  return new Blob([bytes], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
}
