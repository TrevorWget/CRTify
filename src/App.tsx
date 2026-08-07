import { useCallback, useRef, useState } from 'react';
import {
  defaultCrtSettings,
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
import { useMediaLoader } from './hooks/useMediaLoader';
import { useExporter } from './hooks/useExporter';
import { defaultExportFilename } from './utils/imageExport';
import './styles/global.css';

function createTextLayer(): TextLayer {
  return {
    id: crypto.randomUUID(),
    text: 'CRT TEXT',
    x: 0.1,
    y: 0.1,
    fontSize: 32,
    color: '#fff4d6',
    fontFamily: 'VT323',
    textAlign: 'left',
    glow: 10,
    blur: 0,
    brightness: 1,
    strokeWidth: 0,
    strokeColor: '#e63415',
    letterSpacing: 0,
    warp: defaultCrtSettings.curvature,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    skew: 0,
    opacity: 1,
    locked: false,
  };
}

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
    clearMedia,
    clearError: clearLoadError,
  } = useMediaLoader();

  const { exportMedia, exporting, progress, error: exportError, clearError: clearExportError } =
    useExporter();

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

  const handleAddLayer = useCallback(() => {
    pushHistory();
    const layer = createTextLayer();
    setTextLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  }, [pushHistory]);

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
      const defaults = createTextLayer();
      setTextLayers((prev) =>
        prev.map((layer) =>
          layer.id === id
            ? { ...defaults, id, text: current.text, x: current.x, y: current.y }
            : layer,
        ),
      );
    },
    [textLayers, pushHistory],
  );

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

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span className="title-glow">CRTify</span>
        </h1>
        <p className="app-subtitle">CRT monitor overlay generator</p>
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
          <MediaUploader
            onFileSelect={loadFile}
            loading={loading}
            media={media}
            onClear={clearMedia}
          />
          <TextOverlayEditor
            layers={textLayers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            onAddLayer={handleAddLayer}
            onDeleteLayer={handleDeleteLayer}
            onMoveLayer={handleMoveLayer}
            onResetLayer={handleResetLayer}
          />
        </aside>

        <section className="preview-section">
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
        </section>

        <aside className="sidebar sidebar-right">
          <EffectControls
            settings={settings}
            onChange={handleSettingsChange}
            onReset={() => handleSettingsChange({ ...defaultCrtSettings })}
            crtAffectText={crtAffectText}
            onCrtAffectTextChange={handleCrtAffectTextChange}
          />
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
        <p>
          Max resolution 1920px · GIFs up to 1200 frames within memory limits · Video export may
          take a while
        </p>
      </footer>
    </div>
  );
}
