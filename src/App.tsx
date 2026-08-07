import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createShapeLayer,
  createTextLayer,
  defaultCrtSettings,
  duplicateTextLayer,
  type CrtPreset,
  type CrtSettings,
  type ExportFormat,
  type ExportOptionsConfig,
  type ExportQueueItem,
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
import { getTimelinePosition } from './utils/animationMedia';
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
  const [settingsB, setSettingsB] = useState<CrtSettings>({ ...defaultCrtSettings });
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [crtAffectText, setCrtAffectText] = useState(false);
  const [crtAffectTextB, setCrtAffectTextB] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareSlot, setCompareSlot] = useState<'A' | 'B'>('A');
  const [videoTime, setVideoTime] = useState(0);
  const [exportQueue, setExportQueue] = useState<ExportQueueItem[]>([]);
  const exportQueueBusy = useRef(false);
  const historyRef = useRef<EditorSnapshot[]>([]);
  const redoRef = useRef<EditorSnapshot[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

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

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void loadFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadFile]);

  const pushHistory = useCallback(() => {
    historyRef.current = [
      ...historyRef.current.slice(-79),
      {
        settings: { ...settings },
        textLayers: textLayers.map((layer) => ({ ...layer })),
        crtAffectText,
      },
    ];
    redoRef.current = [];
    setHistoryCount(historyRef.current.length);
    setRedoCount(0);
  }, [settings, textLayers, crtAffectText]);

  const applySnapshot = useCallback((snapshot: EditorSnapshot) => {
    setSettings(snapshot.settings);
    setTextLayers(snapshot.textLayers);
    setCrtAffectText(snapshot.crtAffectText);
    setSelectedLayerId((current) =>
      current && snapshot.textLayers.some((layer) => layer.id === current) ? current : null,
    );
  }, []);

  const handleUndo = useCallback(() => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    redoRef.current = [
      ...redoRef.current,
      {
        settings: { ...settings },
        textLayers: textLayers.map((layer) => ({ ...layer })),
        crtAffectText,
      },
    ];
    applySnapshot(snapshot);
    setHistoryCount(historyRef.current.length);
    setRedoCount(redoRef.current.length);
  }, [settings, textLayers, crtAffectText, applySnapshot]);

  const handleRedo = useCallback(() => {
    const snapshot = redoRef.current.pop();
    if (!snapshot) return;
    historyRef.current = [
      ...historyRef.current,
      {
        settings: { ...settings },
        textLayers: textLayers.map((layer) => ({ ...layer })),
        crtAffectText,
      },
    ];
    applySnapshot(snapshot);
    setHistoryCount(historyRef.current.length);
    setRedoCount(redoRef.current.length);
  }, [settings, textLayers, crtAffectText, applySnapshot]);

  const handleResetAll = useCallback(() => {
    pushHistory();
    setSettings({ ...defaultCrtSettings });
    setTextLayers([]);
    setSelectedLayerId(null);
    setCrtAffectText(false);
  }, [pushHistory]);

  const activeSettings = compareEnabled && compareSlot === 'B' ? settingsB : settings;
  const activeCrtAffectText =
    compareEnabled && compareSlot === 'B' ? crtAffectTextB : crtAffectText;

  const handleSettingsChange = useCallback(
    (next: CrtSettings) => {
      pushHistory();
      if (compareEnabled && compareSlot === 'B') setSettingsB(next);
      else setSettings(next);
    },
    [pushHistory, compareEnabled, compareSlot],
  );

  const handleCrtAffectTextChange = useCallback(
    (value: boolean) => {
      pushHistory();
      if (compareEnabled && compareSlot === 'B') setCrtAffectTextB(value);
      else setCrtAffectText(value);
    },
    [pushHistory, compareEnabled, compareSlot],
  );

  const handleApplyPreset = useCallback(
    (preset: CrtPreset) => {
      pushHistory();
      if (compareEnabled && compareSlot === 'B') {
        setSettingsB({ ...preset.settings });
        if (preset.crtAffectText !== undefined) setCrtAffectTextB(preset.crtAffectText);
      } else {
        setSettings({ ...preset.settings });
        if (preset.crtAffectText !== undefined) setCrtAffectText(preset.crtAffectText);
      }
    },
    [pushHistory, compareEnabled, compareSlot],
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

  const handleReorderLayers = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      pushHistory();
      setTextLayers((prev) => {
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex >= prev.length
        ) {
          return prev;
        }
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [pushHistory],
  );

  const handleDuplicateLayer = useCallback(
    (id: string) => {
      const source = textLayers.find((layer) => layer.id === id);
      if (!source) return;
      pushHistory();
      const clone = duplicateTextLayer(source);
      setTextLayers((prev) => {
        const index = prev.findIndex((layer) => layer.id === id);
        if (index === -1) return [...prev, clone];
        const next = [...prev];
        next.splice(index + 1, 0, clone);
        return next;
      });
      setSelectedLayerId(clone.id);
    },
    [textLayers, pushHistory],
  );

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
      const item: ExportQueueItem = {
        id: crypto.randomUUID(),
        label: `${format.toUpperCase()} · ${exportConfig.filename || 'export'}`,
        format,
        options: exportConfig,
        status: 'queued',
      };
      setExportQueue((prev) => [...prev, item]);
    },
    [media],
  );

  const handleEnqueueRecipe = useCallback(
    (format: ExportFormat, exportConfig: ExportOptionsConfig) => {
      handleExport(format, exportConfig);
    },
    [handleExport],
  );

  const clearFinishedExports = useCallback(() => {
    setExportQueue((prev) => prev.filter((item) => item.status === 'queued' || item.status === 'running'));
  }, []);

  useEffect(() => {
    if (!media || exportQueueBusy.current || exporting) return;
    const nextJob = exportQueue.find((item) => item.status === 'queued');
    if (!nextJob) return;

    exportQueueBusy.current = true;
    setExportQueue((prev) =>
      prev.map((item) => (item.id === nextJob.id ? { ...item, status: 'running' } : item)),
    );

    void exportMedia(nextJob.format, {
      media,
      settings,
      textLayers,
      crtAffectText,
      gifFrameIndex,
      exportConfig: nextJob.options,
    })
      .then(() => {
        setExportQueue((prev) =>
          prev.map((item) => (item.id === nextJob.id ? { ...item, status: 'done' } : item)),
        );
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Export failed';
        setExportQueue((prev) =>
          prev.map((item) =>
            item.id === nextJob.id ? { ...item, status: 'error', error: message } : item,
          ),
        );
      })
      .finally(() => {
        exportQueueBusy.current = false;
      });
  }, [
    exportQueue,
    exporting,
    media,
    settings,
    textLayers,
    crtAffectText,
    gifFrameIndex,
    exportMedia,
  ]);

  const exportDefaultName = defaultExportFilename(textLayers[0]?.text);
  const systemStatus = exporting
    ? 'ENCODING'
    : exportQueue.some((item) => item.status === 'queued' || item.status === 'running')
      ? 'QUEUE'
      : loading
        ? 'LOADING'
        : media
          ? 'MEDIA ONLINE'
          : 'STANDBY';

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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRedo}
            disabled={redoCount === 0}
            title="Redo last undone change"
          >
            ↷ Redo
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
          queue={exportQueue}
          onExport={handleExport}
          onEnqueue={handleEnqueueRecipe}
          onClearFinished={clearFinishedExports}
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
              timeline={getTimelinePosition(media, gifFrameIndex, videoTime)}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onUpdateLayer={handleUpdateLayer}
              onAddLayer={handleAddLayer}
              onAddShape={handleAddShape}
              onAddSticker={handleAddSticker}
              onDeleteLayer={handleDeleteLayer}
              onDuplicateLayer={handleDuplicateLayer}
              onMoveLayer={handleMoveLayer}
              onReorderLayers={handleReorderLayers}
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
            settingsB={compareEnabled ? settingsB : null}
            compareEnabled={compareEnabled}
            textLayers={textLayers}
            crtAffectText={crtAffectText}
            crtAffectTextB={crtAffectTextB}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            gifFrameIndex={gifFrameIndex}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onGifFrameChange={setGifFrameIndex}
            onVideoTimeChange={setVideoTime}
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
            <div className="ab-compare-bar">
              <label className="effect-enable ab-toggle">
                <input
                  type="checkbox"
                  checked={compareEnabled}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    if (enabled) {
                      setSettingsB({ ...settings });
                      setCrtAffectTextB(crtAffectText);
                      setCompareSlot('A');
                    }
                    setCompareEnabled(enabled);
                  }}
                />
                <span>A/B Compare</span>
              </label>
              {compareEnabled && (
                <>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={compareSlot === 'A' ? 'active' : ''}
                      onClick={() => setCompareSlot('A')}
                    >
                      Edit A
                    </button>
                    <button
                      type="button"
                      className={compareSlot === 'B' ? 'active' : ''}
                      onClick={() => setCompareSlot('B')}
                    >
                      Edit B
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      pushHistory();
                      setSettings(settingsB);
                      setSettingsB(settings);
                      setCrtAffectText(crtAffectTextB);
                      setCrtAffectTextB(crtAffectText);
                    }}
                  >
                    Swap A/B
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      pushHistory();
                      setSettingsB({ ...settings });
                      setCrtAffectTextB(crtAffectText);
                    }}
                  >
                    Copy A→B
                  </button>
                </>
              )}
            </div>
            <EffectControls
              settings={activeSettings}
              onChange={handleSettingsChange}
              onReset={() => handleSettingsChange({ ...defaultCrtSettings })}
              crtAffectText={activeCrtAffectText}
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
