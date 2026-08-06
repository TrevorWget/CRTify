import type { FontFamily, TextLayer } from '../types/crt';

interface TextOverlayEditorProps {
  layers: TextLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, partial: Partial<TextLayer>) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onResetLayer: (id: string) => void;
}

const FONTS: FontFamily[] = [
  'VT323',
  'Press Start 2P',
  'Bungee',
  'Audiowide',
  'Orbitron',
  'Black Ops One',
  'Share Tech Mono',
  'monospace',
];

function LayerSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="control-row">
      <span className="control-label">
        {label}
        <span className="control-value">{Number.isInteger(step) ? value : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function TextOverlayEditor({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onMoveLayer,
  onResetLayer,
}: TextOverlayEditorProps) {
  const selected = layers.find((l) => l.id === selectedLayerId);

  return (
    <div className="text-overlay-editor">
      <div className="text-header">
        <h3>Text Layers</h3>
        <button type="button" className="btn btn-small" onClick={onAddLayer}>
          + Add
        </button>
      </div>

      <ul className="layer-list">
        {layers.map((layer, index) => (
          <li
            key={layer.id}
            className={`layer-item ${layer.id === selectedLayerId ? 'selected' : ''}`}
            onClick={() => onSelectLayer(layer.id)}
          >
            <span className="layer-name">{layer.text || '(empty)'}</span>
            <div className="layer-actions">
              <button
                type="button"
                className="btn-icon"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveLayer(layer.id, 'up');
                }}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-icon"
                disabled={index === layers.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveLayer(layer.id, 'down');
                }}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateLayer(layer.id, { locked: !layer.locked });
                }}
                title={layer.locked ? 'Unlock' : 'Lock'}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>
              <button
                type="button"
                className="btn-icon btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLayer(layer.id);
                }}
                title="Delete"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="layer-editor">
          <div className="section-heading">
            <span className="editor-kicker">TYPE CONTROLS</span>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => onResetLayer(selected.id)}
            >
              Defaults
            </button>
          </div>
          <label className="control-row">
            <span className="control-label">Text</span>
            <input
              type="text"
              value={selected.text}
              onChange={(e) => onUpdateLayer(selected.id, { text: e.target.value })}
            />
          </label>
          <label className="control-row">
            <span className="control-label">Font</span>
            <select
              value={selected.fontFamily}
              onChange={(e) =>
                onUpdateLayer(selected.id, { fontFamily: e.target.value as FontFamily })
              }
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <div className="control-row">
            <span className="control-label">Alignment</span>
            <div className="segmented-control">
              {(['left', 'center', 'right'] as const).map((alignment) => (
                <button
                  key={alignment}
                  type="button"
                  className={selected.textAlign === alignment ? 'active' : ''}
                  onClick={() => onUpdateLayer(selected.id, { textAlign: alignment })}
                  title={`Align ${alignment}`}
                >
                  {alignment === 'left' ? '≡' : alignment === 'center' ? '≡' : '≡'}
                  <span>{alignment[0].toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="control-row">
            <span className="control-label">Position</span>
            <div className="position-buttons">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => onUpdateLayer(selected.id, { x: 0.5, textAlign: 'center' })}
              >
                Center X
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => onUpdateLayer(selected.id, { y: 0.5 })}
              >
                Center Y
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() =>
                  onUpdateLayer(selected.id, { x: 0.5, y: 0.5, textAlign: 'center' })
                }
              >
                Center both
              </button>
            </div>
          </div>
          <label className="control-row">
            <span className="control-label">Size</span>
            <input
              type="number"
              min={8}
              max={120}
              value={selected.fontSize}
              onChange={(e) =>
                onUpdateLayer(selected.id, { fontSize: parseInt(e.target.value, 10) || 16 })
              }
            />
          </label>
          <label className="control-row">
            <span className="control-label">Color</span>
            <input
              type="color"
              value={selected.color}
              onChange={(e) => onUpdateLayer(selected.id, { color: e.target.value })}
            />
          </label>
          <div className="control-divider">DISTORTION</div>
          <LayerSlider label="Warp" value={selected.warp} min={0} max={1} step={0.01} onChange={(warp) => onUpdateLayer(selected.id, { warp })} />
          <LayerSlider label="Rotation" value={selected.rotation} min={-180} max={180} step={1} onChange={(rotation) => onUpdateLayer(selected.id, { rotation })} />
          <LayerSlider label="Horizontal scale" value={selected.scaleX} min={0.25} max={2.5} step={0.01} onChange={(scaleX) => onUpdateLayer(selected.id, { scaleX })} />
          <LayerSlider label="Vertical scale" value={selected.scaleY} min={0.25} max={2.5} step={0.01} onChange={(scaleY) => onUpdateLayer(selected.id, { scaleY })} />
          <LayerSlider label="Skew" value={selected.skew} min={-45} max={45} step={1} onChange={(skew) => onUpdateLayer(selected.id, { skew })} />
          <LayerSlider label="Letter spacing" value={selected.letterSpacing} min={-4} max={30} step={1} onChange={(letterSpacing) => onUpdateLayer(selected.id, { letterSpacing })} />

          <div className="control-divider">SIGNAL / GLOW</div>
          <LayerSlider label="Glow" value={selected.glow} min={0} max={50} step={1} onChange={(glow) => onUpdateLayer(selected.id, { glow })} />
          <LayerSlider label="Soft blur" value={selected.blur} min={0} max={8} step={0.1} onChange={(blur) => onUpdateLayer(selected.id, { blur })} />
          <LayerSlider label="Stroke" value={selected.strokeWidth} min={0} max={12} step={0.5} onChange={(strokeWidth) => onUpdateLayer(selected.id, { strokeWidth })} />
          {selected.strokeWidth > 0 && (
            <label className="control-row">
              <span className="control-label">Stroke color</span>
              <input type="color" value={selected.strokeColor} onChange={(event) => onUpdateLayer(selected.id, { strokeColor: event.target.value })} />
            </label>
          )}
          <LayerSlider label="Opacity" value={selected.opacity} min={0} max={1} step={0.01} onChange={(opacity) => onUpdateLayer(selected.id, { opacity })} />
        </div>
      )}
    </div>
  );
}
