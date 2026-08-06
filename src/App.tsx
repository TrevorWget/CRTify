import { useCallback, useState } from 'react';
import {
  defaultCrtSettings,
  type CrtSettings,
  type ExportFormat,
  type TextLayer,
} from './types/crt';
import { MediaUploader } from './components/MediaUploader';
import { PreviewCanvas } from './components/PreviewCanvas';
import { EffectControls } from './components/EffectControls';
import { TextOverlayEditor } from './components/TextOverlayEditor';
import { ExportPanel } from './components/ExportPanel';
import { useMediaLoader } from './hooks/useMediaLoader';
import { useExporter } from './hooks/useExporter';
import './styles/global.css';

function createTextLayer(): TextLayer {
  return {
    id: crypto.randomUUID(),
    text: 'CRT TEXT',
    x: 0.1,
    y: 0.1,
    fontSize: 32,
    color: '#33ff66',
    fontFamily: 'VT323',
    glow: 8,
    opacity: 1,
    locked: false,
  };
}

export default function App() {
  const [settings, setSettings] = useState<CrtSettings>(defaultCrtSettings);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [crtAffectText, setCrtAffectText] = useState(false);

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

  const handleAddLayer = useCallback(() => {
    const layer = createTextLayer();
    setTextLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  }, []);

  const handleUpdateLayer = useCallback((id: string, partial: Partial<TextLayer>) => {
    setTextLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...partial } : l)));
  }, []);

  const handleDeleteLayer = useCallback(
    (id: string) => {
      setTextLayers((prev) => prev.filter((l) => l.id !== id));
      if (selectedLayerId === id) setSelectedLayerId(null);
    },
    [selectedLayerId],
  );

  const handleMoveLayer = useCallback((id: string, direction: 'up' | 'down') => {
    setTextLayers((prev) => {
      const index = prev.findIndex((l) => l.id === id);
      if (index === -1) return prev;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  }, []);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!media) return;
      exportMedia(format, {
        media,
        settings,
        textLayers,
        crtAffectText,
        gifFrameIndex,
      });
    },
    [media, settings, textLayers, crtAffectText, gifFrameIndex, exportMedia],
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span className="title-glow">CRTify</span>
        </h1>
        <p className="app-subtitle">CRT monitor overlay generator</p>
        <ExportPanel
          media={media}
          exporting={exporting}
          progress={progress}
          error={exportError}
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
            onChange={setSettings}
            crtAffectText={crtAffectText}
            onCrtAffectTextChange={setCrtAffectText}
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
        <p>Max resolution 1920px · GIFs limited to 300 frames · Video export may take a while</p>
      </footer>
    </div>
  );
}
