import {
  defaultExportOptions,
  type ExportFormat,
  type ExportOptionsConfig,
  type ExportRecipe,
} from '../types/crt';

const STORAGE_KEY = 'crtify.exportRecipes.v1';

const base = defaultExportOptions();

export const BUILTIN_EXPORT_RECIPES: ExportRecipe[] = [
  {
    id: 'full-png',
    name: 'Full PNG',
    description: 'Lossless full-resolution still',
    builtin: true,
    format: 'png',
    options: { ...base, scalePercent: 100 },
  },
  {
    id: 'web-jpeg',
    name: 'Web JPEG',
    description: '75% scale, balanced quality',
    builtin: true,
    format: 'jpeg',
    options: { ...base, scalePercent: 75, imageQuality: 0.85 },
  },
  {
    id: 'compact-gif',
    name: 'Compact GIF',
    description: 'Half scale, skip frames, faster encode',
    builtin: true,
    format: 'gif',
    options: { ...base, scalePercent: 50, frameSkip: 2, gifQuality: 18 },
  },
  {
    id: 'social-mp4',
    name: 'Social MP4',
    description: 'Optimized H.264 with audio when available',
    builtin: true,
    format: 'mp4',
    options: { ...base, scalePercent: 75, optimizeVideo: true, keepAudio: true, frameSkip: 1 },
  },
  {
    id: 'archive-webm',
    name: 'Archive WebM',
    description: 'Full-res WebM, quality over size',
    builtin: true,
    format: 'webm',
    options: { ...base, scalePercent: 100, optimizeVideo: false, keepAudio: true },
  },
];

function readCustom(): ExportRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExportRecipe[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((recipe) => ({
      ...recipe,
      id: recipe.id || crypto.randomUUID(),
      builtin: false,
      options: { ...base, ...recipe.options },
    }));
  } catch {
    return [];
  }
}

function writeCustom(recipes: ExportRecipe[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

export function listExportRecipes(): ExportRecipe[] {
  return [...BUILTIN_EXPORT_RECIPES, ...readCustom()];
}

export function saveExportRecipe(
  name: string,
  format: ExportFormat,
  options: Omit<ExportOptionsConfig, 'filename'> & { filename?: string },
): ExportRecipe {
  const recipe: ExportRecipe = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Custom Export',
    format,
    options: { ...base, ...options },
    builtin: false,
  };
  writeCustom([...readCustom(), recipe]);
  return recipe;
}

export function deleteExportRecipe(id: string) {
  writeCustom(readCustom().filter((recipe) => recipe.id !== id));
}
