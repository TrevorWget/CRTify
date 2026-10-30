import {
  normalizeCrtSettings,
  normalizeTextLayer,
  type CrtSettings,
  type CrtifyProjectV1,
  type ExportOptionsConfig,
  type LoadedMedia,
  type TextLayer,
} from '../types/crt';
import { downloadBlob } from './imageExport';
import { loadImageElement } from './textCompositor';

const SHARE_PREFIX = 'look=';
const EMBEDDED_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,/;

export interface ShareableLook {
  settings: CrtSettings;
  crtAffectText?: boolean;
  textLayers?: Array<Omit<TextLayer, 'imageElement'>>;
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function serializeLayers(layers: TextLayer[]): Array<Omit<TextLayer, 'imageElement'>> {
  return layers.map(({ imageElement: _ignored, ...rest }) => ({ ...rest }));
}

function imageToDataUrl(image: HTMLImageElement): string | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Sticker blob URLs die with the tab, so project files carry the pixels inline. */
function serializeLayersWithImages(layers: TextLayer[]): Array<Omit<TextLayer, 'imageElement'>> {
  return layers.map(({ imageElement, ...rest }) => {
    if (rest.kind !== 'image') return { ...rest };
    const imageUrl =
      rest.imageUrl && EMBEDDED_IMAGE.test(rest.imageUrl)
        ? rest.imageUrl
        : imageElement
          ? imageToDataUrl(imageElement)
          : undefined;
    return { ...rest, imageUrl };
  });
}

/** Decode embedded sticker images. Anything other than an inline data URL is dropped. */
export async function hydrateImageLayers(layers: TextLayer[]): Promise<TextLayer[]> {
  return Promise.all(
    layers.map(async (layer) => {
      if (layer.kind !== 'image') return layer;
      if (!layer.imageUrl || !EMBEDDED_IMAGE.test(layer.imageUrl)) {
        return { ...layer, imageUrl: undefined, imageElement: undefined };
      }
      try {
        return { ...layer, imageElement: await loadImageElement(layer.imageUrl) };
      } catch {
        return { ...layer, imageUrl: undefined, imageElement: undefined };
      }
    }),
  );
}

export function buildProject(
  settings: CrtSettings,
  textLayers: TextLayer[],
  crtAffectText: boolean,
  media: LoadedMedia | null,
  exportOptions?: Partial<ExportOptionsConfig>,
  name?: string,
): CrtifyProjectV1 {
  return {
    version: 1,
    name,
    settings: normalizeCrtSettings(settings),
    crtAffectText,
    textLayers: serializeLayersWithImages(textLayers),
    exportOptions,
    mediaHint: media
      ? {
          type: media.type,
          width: media.width,
          height: media.height,
          fileName: media.fileName,
        }
      : undefined,
  };
}

export function downloadProject(project: CrtifyProjectV1, filename = 'project.crtify.json') {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function parseProject(data: unknown): CrtifyProjectV1 {
  if (!data || typeof data !== 'object') throw new Error('Invalid project file');
  const raw = data as Partial<CrtifyProjectV1>;
  if (raw.version !== 1) throw new Error('Unsupported project version');
  return {
    version: 1,
    name: raw.name,
    settings: normalizeCrtSettings(raw.settings),
    crtAffectText: Boolean(raw.crtAffectText),
    textLayers: Array.isArray(raw.textLayers)
      ? raw.textLayers.map((layer) => normalizeTextLayer(layer))
      : [],
    exportOptions: raw.exportOptions,
    mediaHint: raw.mediaHint,
  };
}

export async function loadProjectFile(file: File): Promise<CrtifyProjectV1> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Project file is not valid JSON');
  }
  return parseProject(data);
}

export function encodeShareLook(look: ShareableLook): string {
  return `${SHARE_PREFIX}${toBase64Url(JSON.stringify(look))}`;
}

/** Share links can't carry local sticker files, so image layers are left out. */
export function shareableLayers(layers: TextLayer[]): Array<Omit<TextLayer, 'imageElement'>> {
  return serializeLayers(layers.filter((layer) => layer.kind !== 'image'));
}

export function applyShareHash(hash: string = window.location.hash): ShareableLook | null {
  const cleaned = hash.replace(/^#/, '');
  if (!cleaned.startsWith(SHARE_PREFIX)) return null;
  try {
    const payload = JSON.parse(fromBase64Url(cleaned.slice(SHARE_PREFIX.length))) as ShareableLook;
    return {
      settings: normalizeCrtSettings(payload.settings),
      crtAffectText: payload.crtAffectText,
      textLayers: payload.textLayers
        ?.map((layer) => normalizeTextLayer(layer))
        .filter((layer) => layer.kind !== 'image'),
    };
  } catch {
    return null;
  }
}

export function writeShareHash(look: ShareableLook) {
  const next = `#${encodeShareLook(look)}`;
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
  }
}

export async function copyShareLink(look: ShareableLook): Promise<string> {
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${encodeShareLook(look)}`;
  writeShareHash(look);
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard is unavailable; the link is in the address bar instead.');
  }
  await navigator.clipboard.writeText(url);
  return url;
}
