import type { FontFamily, TextLayer } from '../types/crt';

interface TextOverlayEditorProps {
  layers: TextLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, partial: Partial<TextLayer>) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
}

const FONTS: FontFamily[] = ['VT323', 'Press Start 2P', 'monospace'];

export function TextOverlayEditor({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onMoveLayer,
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
          <label className="control-row">
            <span className="control-label">
              Glow
              <span className="control-value">{selected.glow}</span>
            </span>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={selected.glow}
              onChange={(e) =>
                onUpdateLayer(selected.id, { glow: parseInt(e.target.value, 10) })
              }
            />
          </label>
          <label className="control-row">
            <span className="control-label">
              Opacity
              <span className="control-value">{selected.opacity.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selected.opacity}
              onChange={(e) =>
                onUpdateLayer(selected.id, { opacity: parseFloat(e.target.value) })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}
