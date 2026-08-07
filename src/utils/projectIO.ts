import {
  normalizeCrtSettings,
  normalizeTextLayer,
  type CrtSettings,
  type CrtifyProjectV1,
  type ExportOptionsConfig,
  type LoadedMedia,
  type TextLayer,
} from '../types/crt';

const SHARE_PREFIX = 'look=';

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
    textLayers: serializeLayers(textLayers),
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
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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
  return parseProject(JSON.parse(text));
}

export function encodeShareLook(look: ShareableLook): string {
  return `${SHARE_PREFIX}${toBase64Url(JSON.stringify(look))}`;
}

export function applyShareHash(hash: string = window.location.hash): ShareableLook | null {
  const cleaned = hash.replace(/^#/, '');
  if (!cleaned.startsWith(SHARE_PREFIX)) return null;
  try {
    const payload = JSON.parse(fromBase64Url(cleaned.slice(SHARE_PREFIX.length))) as ShareableLook;
    return {
      settings: normalizeCrtSettings(payload.settings),
      crtAffectText: payload.crtAffectText,
      textLayers: payload.textLayers?.map((layer) => normalizeTextLayer(layer)),
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
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
  }
  writeShareHash(look);
  return url;
}
