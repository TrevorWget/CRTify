import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createShapeLayer,
  createTextLayer,
  defaultCrtSettings,
  type CrtPreset,
  type CrtSettings,
  type ExportFormat,
  type ExportOptionsConfig,
  type TextLayer,
} from './types/crt';
import { MediaUploader } from './components/MediaUploader';
import { PreviewCanvas } from './components/PreviewCanvas';
import { EffectControls } from './components/EffectControls';
import { TextOverlayEditor } from './components/TextOverlayEditor';
import { ExportPanel } from './components/ExportPanel';
import { ProjectDock } from './components/ProjectDock';
import { useMediaLoader } from './hooks/useMediaLoader';
import { useExporter } from './hooks/useExporter';
import { defaultExportFilename } from './utils/imageExport';
import { loadImageElement } from './utils/textCompositor';
import {
  applyShareHash,
  buildProject,
  copyShareLink,
  downloadProject,
  loadProjectFile,
} from './utils/projectIO';
import './styles/global.css';

interface EditorSnapshot {
  settings: CrtSettings;
  textLayers: TextLayer[];
  crtAffectText: boolean;
}

export default function App() {
  const [settings, setSettings] = useState<CrtSettings>(defaultCrtSettings);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [crtAffectText, setCrtAffectText] = useState(false);
  const historyRef = useRef<EditorSnapshot[]>([]);
  const [historyCount, setHistoryCount] = useState(0);

  const {
    media,
    loading,
    error: loadError,
    gifFrameIndex,
    setGifFrameIndex,
    isPlaying,
    setIsPlaying,
    loadFile,
    loadBatchFiles,
    captureWebcam,
    clearMedia,
    clearError: clearLoadError,
  } = useMediaLoader();

  const { exportMedia, exporting, progress, error: exportError, clearError: clearExportError } =
    useExporter();

  useEffect(() => {
    const shared = applyShareHash();
    if (!shared) return;
    setSettings(shared.settings);
    if (shared.crtAffectText !== undefined) setCrtAffectText(shared.crtAffectText);
    if (shared.textLayers) setTextLayers(shared.textLayers);
  }, []);

  const pushHistory = useCallback(() => {
    historyRef.current = [
      ...historyRef.current.slice(-79),
      {
        settings: { ...settings },
        textLayers: textLayers.map((layer) => ({ ...layer })),
        crtAffectText,
      },
    ];
    setHistoryCount(historyRef.current.length);
  }, [settings, textLayers, crtAffectText]);

  const handleUndo = useCallback(() => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    setSettings(snapshot.settings);
    setTextLayers(snapshot.textLayers);
    setCrtAffectText(snapshot.crtAffectText);
    setSelectedLayerId((current) =>
      current && snapshot.textLayers.some((layer) => layer.id === current) ? current : null,
    );
    setHistoryCount(historyRef.current.length);
  }, []);

  const handleResetAll = useCallback(() => {
    pushHistory();
    setSettings({ ...defaultCrtSettings });
    setTextLayers([]);
    setSelectedLayerId(null);
    setCrtAffectText(false);
  }, [pushHistory]);

  const handleSettingsChange = useCallback(
    (next: CrtSettings) => {
      pushHistory();
      setSettings(next);
    },
    [pushHistory],
  );

  const handleCrtAffectTextChange = useCallback(
    (value: boolean) => {
      pushHistory();
      setCrtAffectText(value);
    },
    [pushHistory],
  );

  const handleApplyPreset = useCallback(
    (preset: CrtPreset) => {
      pushHistory();
      setSettings({ ...preset.settings });
      if (preset.crtAffectText !== undefined) setCrtAffectText(preset.crtAffectText);
    },
    [pushHistory],
  );

  const handleAddLayer = useCallback(() => {
    pushHistory();
    const layer = createTextLayer();
    setTextLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  }, [pushHistory]);

  const handleAddShape = useCallback(() => {
    pushHistory();
    const layer = createShapeLayer();
    setTextLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  }, [pushHistory]);

  const handleAddSticker = useCallback(
    async (file: File) => {
      pushHistory();
      const url = URL.createObjectURL(file);
      try {
        const imageElement = await loadImageElement(url);
        const layer = createTextLayer({
          kind: 'image',
          text: file.name.replace(/\.[^.]+$/, ''),
          imageUrl: url,
          imageElement,
          x: 0.5,
          y: 0.5,
          scaleX: 0.25,
          scaleY: 0.25,
          glow: 0,
          warp: 0,
        });
        setTextLayers((prev) => [...prev, layer]);
        setSelectedLayerId(layer.id);
      } catch {
        URL.revokeObjectURL(url);
      }
    },
    [pushHistory],
  );

  const handleUpdateLayer = useCallback(
    (id: string, partial: Partial<TextLayer>) => {
      pushHistory();
      setTextLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...partial } : l)));
    },
    [pushHistory],
  );

  const handleDeleteLayer = useCallback(
    (id: string) => {
      pushHistory();
      setTextLayers((prev) => prev.filter((l) => l.id !== id));
      if (selectedLayerId === id) setSelectedLayerId(null);
    },
    [selectedLayerId, pushHistory],
  );

  const handleMoveLayer = useCallback((id: string, direction: 'up' | 'down') => {
    pushHistory();
    setTextLayers((prev) => {
      const index = prev.findIndex((l) => l.id === id);
      if (index === -1) return prev;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  }, [pushHistory]);

  const handleResetLayer = useCallback(
    (id: string) => {
      const current = textLayers.find((layer) => layer.id === id);
      if (!current) return;
      pushHistory();
      const defaults =
        current.kind === 'shape'
          ? createShapeLayer(current.shape)
          : current.kind === 'image'
            ? createTextLayer({ kind: 'image', text: current.text, imageUrl: current.imageUrl })
            : createTextLayer();
      setTextLayers((prev) =>
        prev.map((layer) =>
          layer.id === id
            ? {
                ...defaults,
                id,
                text: current.text,
                x: current.x,
                y: current.y,
                imageUrl: current.imageUrl,
                imageElement: current.imageElement,
                shape: current.shape,
                kind: current.kind,
              }
            : layer,
        ),
      );
    },
    [textLayers, pushHistory],
  );

  const handleSaveProject = useCallback(() => {
    const project = buildProject(settings, textLayers, crtAffectText, media);
    downloadProject(project, `${project.name ?? 'crtify-project'}.crtify.json`);
  }, [settings, textLayers, crtAffectText, media]);

  const handleLoadProject = useCallback(async (file: File) => {
    try {
      const project = await loadProjectFile(file);
      pushHistory();
      setSettings(project.settings);
      setCrtAffectText(project.crtAffectText);
      setTextLayers(project.textLayers);
      setSelectedLayerId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project';
      clearLoadError();
      console.error(message);
    }
  }, [pushHistory, clearLoadError]);

  const handleCopyShareLink = useCallback(async () => {
    await copyShareLink({
      settings,
      crtAffectText,
      textLayers: textLayers.map(({ imageElement: _ignored, ...rest }) => rest),
    });
  }, [settings, crtAffectText, textLayers]);

  const handleExport = useCallback(
    (format: ExportFormat, exportConfig: ExportOptionsConfig) => {
      if (!media) return;
      exportMedia(format, {
        media,
        settings,
        textLayers,
        crtAffectText,
        gifFrameIndex,
        exportConfig,
      });
    },
    [media, settings, textLayers, crtAffectText, gifFrameIndex, exportMedia],
  );

  const exportDefaultName = defaultExportFilename(textLayers[0]?.text);
  const systemStatus = exporting ? 'ENCODING' : loading ? 'LOADING' : media ? 'MEDIA ONLINE' : 'STANDBY';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-serial">VIDEO PROCESSING UNIT // CR-78</span>
          <h1 className="app-title">
            <span className="title-glow">CRTify</span>
          </h1>
        </div>
        <div className="system-status" role="status" aria-live="polite">
          <span className={`status-led ${media ? 'status-led-active' : ''}`} aria-hidden="true" />
          <span>
            SYS.STATUS
            <strong>{systemStatus}</strong>
          </span>
        </div>
        <div className="history-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleUndo}
            disabled={historyCount === 0}
            title="Undo last editor change"
          >
            ↶ Undo
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleResetAll}>
            Reset all
          </button>
        </div>
        <ExportPanel
          media={media}
          exporting={exporting}
          progress={progress}
          error={exportError}
          defaultName={exportDefaultName}
          onExport={handleExport}
          onClearError={clearExportError}
        />
      </header>

      <main className="app-main">
        <aside className="sidebar sidebar-left">
          <div className="sidebar-section sidebar-section-fixed">
            <span className="module-label">01 / INPUT BAY</span>
            <MediaUploader
              onFileSelect={loadFile}
              onWebcamCapture={captureWebcam}
              onBatchFiles={loadBatchFiles}
              loading={loading}
              media={media}
              onClear={clearMedia}
            />
          </div>
          <div className="sidebar-section sidebar-section-scroll">
            <span className="module-label">02 / TYPE DECK</span>
            <TextOverlayEditor
              layers={textLayers}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onUpdateLayer={handleUpdateLayer}
              onAddLayer={handleAddLayer}
              onAddShape={handleAddShape}
              onAddSticker={handleAddSticker}
              onDeleteLayer={handleDeleteLayer}
              onMoveLayer={handleMoveLayer}
              onResetLayer={handleResetLayer}
            />
          </div>
        </aside>

        <section className="preview-section">
          <div className="preview-faceplate">
            <div className="faceplate-label">
              <span>CRT-09 VISUAL MONITOR</span>
              <span>COMPOSITE SIGNAL</span>
            </div>
          <PreviewCanvas
            media={media}
            settings={settings}
            textLayers={textLayers}
            crtAffectText={crtAffectText}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            gifFrameIndex={gifFrameIndex}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onGifFrameChange={setGifFrameIndex}
          />
            <div className="faceplate-footer" aria-hidden="true">
              <span>◉ POWER</span>
              <span>H-SYNC / V-SYNC</span>
              <span>MADE FOR THE FUTURE</span>
            </div>
          </div>
        </section>

        <aside className="sidebar sidebar-right">
          <div className="sidebar-section sidebar-section-scroll">
            <span className="module-label">03 / SIGNAL PROCESSOR</span>
            <EffectControls
              settings={settings}
              onChange={handleSettingsChange}
              onReset={() => handleSettingsChange({ ...defaultCrtSettings })}
              crtAffectText={crtAffectText}
              onCrtAffectTextChange={handleCrtAffectTextChange}
              onApplyPreset={handleApplyPreset}
            />
            <ProjectDock
              onSaveProject={handleSaveProject}
              onLoadProject={handleLoadProject}
              onCopyShareLink={handleCopyShareLink}
            />
          </div>
        </aside>
      </main>

      {(loadError) && (
        <div className="error-toast global-error">
          <span>{loadError}</span>
          <button type="button" className="btn-icon" onClick={clearLoadError}>
            ×
          </button>
        </div>
      )}

      <footer className="app-footer">
        <span>CRTIFY INDUSTRIES // VISUAL SYSTEMS DIVISION</span>
        <p>4096PX MAX · 1200 FRAME BUFFER · LOCAL PROCESSING</p>
        <span>UNIT 01-A</span>
      </footer>
    </div>
  );
}
