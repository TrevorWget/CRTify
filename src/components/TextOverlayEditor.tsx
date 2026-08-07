import { useCallback, useRef, useState } from 'react';
import {
  BUILTIN_FONTS,
  SHAPE_OPTIONS,
  defaultCrtSettings,
  type FontFamily,
  type LayerKeyframe,
  type OverlayLayerKind,
  type TextLayer,
} from '../types/crt';

interface TextOverlayEditorProps {
  layers: TextLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, partial: Partial<TextLayer>) => void;
  onAddLayer: () => void;
  onAddShape: () => void;
  onAddSticker: (file: File) => void;
  onDeleteLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onResetLayer: (id: string) => void;
}

const TEXT_EFFECT_DEFAULTS = {
  warp: defaultCrtSettings.curvature,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  skew: 0,
  letterSpacing: 0,
  lineHeight: 1.15,
  glow: 10,
  blur: 0,
  brightness: 1,
  strokeWidth: 0,
  opacity: 1,
} as const;

const KIND_LABELS: Record<OverlayLayerKind, string> = {
  text: 'TXT',
  image: 'IMG',
  shape: 'SHP',
};

function layerDisplayName(layer: TextLayer): string {
  const prefix = `[${KIND_LABELS[layer.kind]}] `;
  if (layer.kind === 'text') return prefix + (layer.text.split('\n')[0] || '(empty)');
  if (layer.kind === 'shape') {
    const label = SHAPE_OPTIONS.find((option) => option.id === layer.shape)?.label ?? layer.shape ?? 'Shape';
    return prefix + label;
  }
  return prefix + (layer.text || 'Sticker');
}

function LayerSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  defaultValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  defaultValue: number;
}) {
  return (
    <div className="control-row">
      <span className="control-label">
        <button
          type="button"
          className="effect-reset-label"
          onClick={() => onChange(defaultValue)}
          title="Reset to default"
        >
          {label}
        </button>
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
    </div>
  );
}

export function TextOverlayEditor({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onAddShape,
  onAddSticker,
  onDeleteLayer,
  onMoveLayer,
  onResetLayer,
}: TextOverlayEditorProps) {
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const fontFileInputRef = useRef<HTMLInputElement>(null);
  const [customFonts, setCustomFonts] = useState<string[]>([]);

  const selected = layers.find((l) => l.id === selectedLayerId);

  const loadCustomFont = useCallback(
    async (file: File, layerId: string) => {
      const family = file.name.replace(/\.[^.]+$/, '').trim() || 'Custom Font';
      const url = URL.createObjectURL(file);
      try {
        const face = new FontFace(family, `url(${url})`);
        await face.load();
        document.fonts.add(face);
        setCustomFonts((prev) => (prev.includes(family) ? prev : [...prev, family]));
        onUpdateLayer(layerId, { fontFamily: family as FontFamily });
      } catch {
        URL.revokeObjectURL(url);
      }
    },
    [onUpdateLayer],
  );

  const addKeyframe = (layer: TextLayer, t: number) => {
    const frame: LayerKeyframe = { t, x: layer.x, y: layer.y, opacity: layer.opacity };
    const next = [...layer.keyframes.filter((kf) => Math.abs(kf.t - t) > 0.001), frame].sort(
      (a, b) => a.t - b.t,
    );
    onUpdateLayer(layer.id, { keyframes: next });
  };

  const clearKeyframes = (layerId: string) => {
    onUpdateLayer(layerId, { keyframes: [] });
  };

  const handleStickerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onAddSticker(file);
    event.target.value = '';
  };

  const fontOptions = [...BUILTIN_FONTS, ...customFonts.filter((f) => !BUILTIN_FONTS.includes(f as typeof BUILTIN_FONTS[number]))];

  return (
    <div className="text-overlay-editor">
      <div className="text-header">
        <h3>Overlay Layers</h3>
        <div className="layer-add-actions">
          <button type="button" className="btn btn-small" onClick={onAddLayer}>
            + Text
          </button>
          <button type="button" className="btn btn-small" onClick={onAddShape}>
            + Shape
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => stickerInputRef.current?.click()}
          >
            + Sticker
          </button>
          <input
            ref={stickerInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleStickerChange}
          />
        </div>
      </div>

      <ul className="layer-list">
        {layers.map((layer, index) => (
          <li
            key={layer.id}
            className={`layer-item ${layer.id === selectedLayerId ? 'selected' : ''}`}
            onClick={() => onSelectLayer(layer.id)}
          >
            <span className="layer-name">{layerDisplayName(layer)}</span>
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
            <span className="editor-kicker">
              {selected.kind === 'text' ? 'TYPE CONTROLS' : selected.kind === 'shape' ? 'SHAPE CONTROLS' : 'IMAGE CONTROLS'}
            </span>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => onResetLayer(selected.id)}
            >
              Defaults
            </button>
          </div>

          {selected.kind === 'text' && (
            <label className="control-row">
              <span className="control-label">Text</span>
              <textarea
                rows={3}
                value={selected.text}
                onChange={(e) => onUpdateLayer(selected.id, { text: e.target.value })}
              />
            </label>
          )}

          {selected.kind === 'shape' && (
            <div className="control-row">
              <span className="control-label">Shape</span>
              <div className="segmented-control wrap shape-picker">
                {SHAPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={selected.shape === option.id ? 'active' : ''}
                    onClick={() => onUpdateLayer(selected.id, { shape: option.id })}
                    title={option.label}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected.kind === 'text' && (
            <>
              <label className="control-row">
                <span className="control-label">Font</span>
                <select
                  value={selected.fontFamily}
                  onChange={(e) =>
                    onUpdateLayer(selected.id, { fontFamily: e.target.value as FontFamily })
                  }
                >
                  {fontOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <div className="control-row">
                <span className="control-label">Custom font</span>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => fontFileInputRef.current?.click()}
                >
                  Load .ttf/.otf/.woff
                </button>
                <input
                  ref={fontFileInputRef}
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadCustomFont(file, selected.id);
                    e.target.value = '';
                  }}
                />
              </div>
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
                      <span>{alignment[0].toUpperCase()}</span>
                    </button>
                  ))}
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
              <LayerSlider
                label="Line height"
                value={selected.lineHeight}
                min={0.8}
                max={2.5}
                step={0.05}
                defaultValue={TEXT_EFFECT_DEFAULTS.lineHeight}
                onChange={(lineHeight) => onUpdateLayer(selected.id, { lineHeight })}
              />
              <LayerSlider
                label="Letter spacing"
                value={selected.letterSpacing}
                min={-4}
                max={30}
                step={1}
                defaultValue={TEXT_EFFECT_DEFAULTS.letterSpacing}
                onChange={(letterSpacing) => onUpdateLayer(selected.id, { letterSpacing })}
              />
            </>
          )}

          <div className="control-row">
            <span className="control-label">Position</span>
            <div className="position-buttons">
              <button
                type="button"
                className="btn btn-small"
                onClick={() =>
                  onUpdateLayer(selected.id, {
                    x: 0.5,
                    ...(selected.kind === 'text' ? { textAlign: 'center' as const } : {}),
                  })
                }
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
                  onUpdateLayer(selected.id, {
                    x: 0.5,
                    y: 0.5,
                    ...(selected.kind === 'text' ? { textAlign: 'center' as const } : {}),
                  })
                }
              >
                Center both
              </button>
            </div>
          </div>

          <label className="control-row">
            <span className="control-label">Color</span>
            <input
              type="color"
              value={selected.color}
              onChange={(e) => onUpdateLayer(selected.id, { color: e.target.value })}
            />
          </label>

          <LayerSlider
            label="Rotation"
            value={selected.rotation}
            min={-180}
            max={180}
            step={1}
            defaultValue={TEXT_EFFECT_DEFAULTS.rotation}
            onChange={(rotation) => onUpdateLayer(selected.id, { rotation })}
          />
          <LayerSlider
            label="Horizontal scale"
            value={selected.scaleX}
            min={0.05}
            max={2.5}
            step={0.01}
            defaultValue={TEXT_EFFECT_DEFAULTS.scaleX}
            onChange={(scaleX) => onUpdateLayer(selected.id, { scaleX })}
          />
          <LayerSlider
            label="Vertical scale"
            value={selected.scaleY}
            min={0.05}
            max={2.5}
            step={0.01}
            defaultValue={TEXT_EFFECT_DEFAULTS.scaleY}
            onChange={(scaleY) => onUpdateLayer(selected.id, { scaleY })}
          />
          <LayerSlider
            label="Opacity"
            value={selected.opacity}
            min={0}
            max={1}
            step={0.01}
            defaultValue={TEXT_EFFECT_DEFAULTS.opacity}
            onChange={(opacity) => onUpdateLayer(selected.id, { opacity })}
          />

          <div className="control-divider">DISTORTION</div>
          <LayerSlider
            label="Warp"
            value={selected.warp}
            min={0}
            max={1}
            step={0.01}
            defaultValue={selected.kind === 'text' ? TEXT_EFFECT_DEFAULTS.warp : 0}
            onChange={(warp) => onUpdateLayer(selected.id, { warp })}
          />
          <LayerSlider
            label="Skew"
            value={selected.skew}
            min={-45}
            max={45}
            step={1}
            defaultValue={TEXT_EFFECT_DEFAULTS.skew}
            onChange={(skew) => onUpdateLayer(selected.id, { skew })}
          />

          <div className="control-divider">SIGNAL / GLOW</div>
          <LayerSlider
            label="Glow"
            value={selected.glow}
            min={0}
            max={50}
            step={1}
            defaultValue={selected.kind === 'text' ? TEXT_EFFECT_DEFAULTS.glow : 0}
            onChange={(glow) => onUpdateLayer(selected.id, { glow })}
          />
          <LayerSlider
            label="Soft blur"
            value={selected.blur}
            min={0}
            max={8}
            step={0.1}
            defaultValue={TEXT_EFFECT_DEFAULTS.blur}
            onChange={(blur) => onUpdateLayer(selected.id, { blur })}
          />
          <LayerSlider
            label="Brightness"
            value={selected.brightness}
            min={0.25}
            max={3}
            step={0.01}
            defaultValue={TEXT_EFFECT_DEFAULTS.brightness}
            onChange={(brightness) => onUpdateLayer(selected.id, { brightness })}
          />
          <LayerSlider
            label="Stroke"
            value={selected.strokeWidth}
            min={0}
            max={12}
            step={0.5}
            defaultValue={TEXT_EFFECT_DEFAULTS.strokeWidth}
            onChange={(strokeWidth) => onUpdateLayer(selected.id, { strokeWidth })}
          />
          {selected.strokeWidth > 0 && (
            <label className="control-row">
              <span className="control-label">Stroke color</span>
              <input
                type="color"
                value={selected.strokeColor}
                onChange={(event) =>
                  onUpdateLayer(selected.id, { strokeColor: event.target.value })
                }
              />
            </label>
          )}

          <div className="control-divider">KEYFRAMES</div>
          <div className="keyframe-actions">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => addKeyframe(selected, 0)}
            >
              @ 0%
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => addKeyframe(selected, 0.5)}
            >
              @ 50%
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => addKeyframe(selected, 1)}
            >
              @ 100%
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => clearKeyframes(selected.id)}
              disabled={selected.keyframes.length === 0}
            >
              Clear all
            </button>
          </div>
          {selected.keyframes.length > 0 && (
            <ul className="keyframe-list">
              {selected.keyframes.map((kf, index) => (
                <li key={`${kf.t}-${index}`} className="keyframe-item">
                  <span>
                    t={Math.round(kf.t * 100)}% · x={kf.x?.toFixed(2)} · y={kf.y?.toFixed(2)} · α=
                    {kf.opacity?.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
