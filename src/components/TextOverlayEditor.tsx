import { useCallback, useRef, useState } from 'react';
import {
  BUILTIN_FONTS,
  LAYER_EFFECT_OPTIONS,
  SHAPE_OPTIONS,
  createLayerEffect,
  defaultCrtSettings,
  type FontFamily,
  type LayerEffect,
  type LayerEffectKind,
  type LayerEffectPreset,
  type LayerKeyframe,
  type OverlayLayerKind,
  type TextLayer,
} from '../types/crt';
import {
  positionUpdate,
  removeKeyframe,
  resolveLayerAtTime,
  updateKeyframe,
  upsertKeyframe,
} from '../utils/keyframes';
import {
  clonePresetEffects,
  deleteLayerEffectPreset,
  listLayerEffectPresets,
  saveLayerEffectPreset,
} from '../utils/effectPresets';
import { CollapsibleSection } from './CollapsibleSection';

const ANIM_FX_FIELD_HELP = {
  Amt: 'How strong the effect is — higher values make the motion or distortion more extreme.',
  Spd: 'How fast the effect cycles over the timeline. 1 is the default rate; higher speeds finish more cycles per loop.',
  Phase: 'Offsets where the cycle starts so stacked effects stay out of sync with each other.',
  Start: 'Normalized timeline position (0–100%) where this effect becomes active.',
  End: 'Normalized timeline position (0–100%) where this effect stops.',
  'Fade In': 'Portion of the active window spent ramping the effect up from zero.',
  'Fade Out': 'Portion of the active window spent ramping the effect down to zero.',
} as const;

const TEXT_FX_FIELD_HELP: Partial<
  Record<LayerEffectKind, Partial<Record<keyof typeof ANIM_FX_FIELD_HELP, string>>>
> = {
  typewriter: {
    Amt: 'Reserved for future stagger tuning. Leave at 1 for a straight left-to-right reveal.',
    Spd: 'How quickly characters appear within the Start–End window. Higher = faster reveal; completes once and holds.',
    Phase: 'Delays when the reveal begins inside the Start–End window (0 = immediate, 1 = near the end).',
    Start: 'Timeline position where the reveal begins (0% = start of the loop).',
    End: 'Timeline position where every character is visible. The reveal does not loop again.',
  },
  scramble: {
    Amt: 'How aggressively unrevealed characters shuffle (higher = more glyph changes while settling).',
    Spd: 'How fast characters shuffle and settle within the Start–End window. Completes once and holds.',
    Phase: 'Delays when scrambling begins inside the Start–End window.',
    Start: 'Timeline position where scrambling begins.',
    End: 'Timeline position where all characters show their final glyphs.',
  },
};

function animFxHelp(
  kind: LayerEffectKind,
  field: keyof typeof ANIM_FX_FIELD_HELP,
): string {
  return TEXT_FX_FIELD_HELP[kind]?.[field] ?? ANIM_FX_FIELD_HELP[field];
}

interface TextOverlayEditorProps {
  layers: TextLayer[];
  /** Normalized playhead position, used so position edits target the active keyframe. */
  timeline: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, partial: Partial<TextLayer>) => void;
  onAddLayer: () => void;
  onAddShape: () => void;
  onAddSticker: (file: File) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
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

function KeyframeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  help,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  help?: string;
}) {
  return (
    <label className="keyframe-field" title={help}>
      <span title={help}>{label}</span>
      <input
        type="number"
        value={Number(value.toFixed(step < 1 ? 2 : 0))}
        min={min}
        max={max}
        step={step}
        title={help}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
      />
    </label>
  );
}

export function TextOverlayEditor({
  layers,
  timeline,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onAddShape,
  onAddSticker,
  onDeleteLayer,
  onDuplicateLayer,
  onMoveLayer,
  onReorderLayers,
  onResetLayer,
}: TextOverlayEditorProps) {
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const fontFileInputRef = useRef<HTMLInputElement>(null);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [fxPresets, setFxPresets] = useState<LayerEffectPreset[]>(() => listLayerEffectPresets());
  const [fxPresetName, setFxPresetName] = useState('');

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
    const pose = resolveLayerAtTime(layer, t);
    const frame: LayerKeyframe = { t, x: pose.x, y: pose.y, opacity: pose.opacity };
    onUpdateLayer(layer.id, { keyframes: upsertKeyframe(layer.keyframes, frame) });
  };

  const patchKeyframe = (layer: TextLayer, id: string, patch: Partial<LayerKeyframe>) => {
    onUpdateLayer(layer.id, { keyframes: updateKeyframe(layer.keyframes, id, patch) });
  };

  const deleteKeyframe = (layer: TextLayer, id: string) => {
    onUpdateLayer(layer.id, { keyframes: removeKeyframe(layer.keyframes, id) });
  };

  const clearKeyframes = (layerId: string) => {
    onUpdateLayer(layerId, { keyframes: [] });
  };

  const addEffect = (layer: TextLayer, kind: LayerEffectKind) => {
    onUpdateLayer(layer.id, { effects: [...layer.effects, createLayerEffect(kind)] });
  };

  const patchEffect = (layer: TextLayer, id: string, patch: Partial<LayerEffect>) => {
    onUpdateLayer(layer.id, {
      effects: layer.effects.map((effect) => (effect.id === id ? { ...effect, ...patch } : effect)),
    });
  };

  const deleteEffect = (layer: TextLayer, id: string) => {
    onUpdateLayer(layer.id, { effects: layer.effects.filter((effect) => effect.id !== id) });
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

      <ul className="layer-list layer-stack">
        {layers.map((layer, index) => (
          <li
            key={layer.id}
            className={`layer-item ${layer.id === selectedLayerId ? 'selected' : ''}${
              dropIndex === index ? ' layer-drop-target' : ''
            }${dragIndex === index ? ' layer-dragging' : ''}`}
            draggable
            onDragStart={(event) => {
              setDragIndex(index);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', String(index));
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (dropIndex !== index) setDropIndex(index);
            }}
            onDragLeave={() => {
              if (dropIndex === index) setDropIndex(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const from = Number(event.dataTransfer.getData('text/plain'));
              if (Number.isFinite(from) && from !== index) onReorderLayers(from, index);
              setDragIndex(null);
              setDropIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDropIndex(null);
            }}
            onClick={() => onSelectLayer(layer.id)}
          >
            <span className="layer-stack-handle" title="Drag to reorder" aria-hidden="true">
              ⋮⋮
            </span>
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
                  onDuplicateLayer(layer.id);
                }}
                title="Duplicate layer"
              >
                ⎘
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
                      title={`Align text ${alignment} relative to the layer anchor (Position X/Y)`}
                    >
                      <span>{alignment[0].toUpperCase()}</span>
                    </button>
                  ))}
                </div>
                <small className="control-hint">
                  L/C/R aligns the text block around its anchor point. Position buttons only move the
                  anchor — they do not change alignment.
                </small>
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
                  onUpdateLayer(selected.id, positionUpdate(selected, { x: 0.5 }, timeline))
                }
              >
                Center X
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() =>
                  onUpdateLayer(selected.id, positionUpdate(selected, { y: 0.5 }, timeline))
                }
              >
                Center Y
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() =>
                  onUpdateLayer(selected.id, positionUpdate(selected, { x: 0.5, y: 0.5 }, timeline))
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

          <CollapsibleSection title="DISTORTION" storageKey="overlay-distortion">
            <div className="control-row">
              <span className="control-label">CRT stack</span>
              <div className="segmented-control">
                {(
                  [
                    { id: 'inherit', label: 'Inherit', value: null as boolean | null },
                    { id: 'on', label: 'On', value: true },
                    { id: 'off', label: 'Off', value: false },
                  ] as const
                ).map((option) => {
                  const current =
                    selected.crtAffect === undefined || selected.crtAffect === null
                      ? null
                      : selected.crtAffect;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={current === option.value ? 'active' : ''}
                      title={
                        option.id === 'inherit'
                          ? 'Use the global CRT-affect overlays toggle'
                          : option.id === 'on'
                            ? 'Force full CRT processing on this layer'
                            : 'Skip full CRT processing (warp/shader FX still apply)'
                      }
                      onClick={() => onUpdateLayer(selected.id, { crtAffect: option.value })}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <small className="control-hint">
                Per-layer override for text, shapes, and stickers. Inherit follows the global toggle.
              </small>
            </div>
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
          </CollapsibleSection>

          <CollapsibleSection title="SIGNAL / GLOW" storageKey="overlay-signal">
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
          </CollapsibleSection>

          <CollapsibleSection title="ANIM FX" storageKey="overlay-anim-fx">
            <div className="fx-preset-rack">
              <div className="segmented-control wrap">
                {fxPresets.map((preset) => (
                  <span key={preset.id} className="preset-rack-item">
                    <button
                      type="button"
                      title={`Apply ${preset.name}`}
                      onClick={() =>
                        onUpdateLayer(selected.id, { effects: clonePresetEffects(preset) })
                      }
                    >
                      {preset.name}
                    </button>
                    {!preset.builtin && (
                      <button
                        type="button"
                        className="btn-icon btn-danger preset-delete"
                        title={`Delete ${preset.name}`}
                        onClick={() => {
                          deleteLayerEffectPreset(preset.id);
                          setFxPresets(listLayerEffectPresets());
                        }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="preset-rack-save">
                <input
                  type="text"
                  placeholder="FX preset name"
                  value={fxPresetName}
                  onChange={(event) => setFxPresetName(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={selected.effects.length === 0}
                  onClick={() => {
                    saveLayerEffectPreset(fxPresetName, selected.effects);
                    setFxPresetName('');
                    setFxPresets(listLayerEffectPresets());
                  }}
                >
                  Save FX
                </button>
              </div>
            </div>
            <div className="keyframe-actions">
              {LAYER_EFFECT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="btn btn-small"
                  title={option.description}
                  onClick={() => addEffect(selected, option.id)}
                >
                  + {option.label}
                </button>
              ))}
            </div>
            {selected.effects.length > 0 ? (
              <ul className="keyframe-list">
                {selected.effects.map((effect, index) => {
                  const meta = LAYER_EFFECT_OPTIONS.find((option) => option.id === effect.kind);
                  return (
                    <li key={effect.id} className="keyframe-item">
                      <div className="keyframe-row-head">
                        <label className="effect-enable">
                          <input
                            type="checkbox"
                            checked={effect.enabled}
                            onChange={(event) =>
                              patchEffect(selected, effect.id, { enabled: event.target.checked })
                            }
                            aria-label={`Enable ${meta?.label ?? effect.kind}`}
                          />
                          <span>
                            #{index + 1} {meta?.label ?? effect.kind}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="btn btn-small keyframe-remove"
                          onClick={() => deleteEffect(selected, effect.id)}
                          title="Remove this effect"
                        >
                          ✕
                        </button>
                      </div>
                      <small className="keyframe-hint">{meta?.description}</small>
                      <div className="keyframe-fields effect-fields">
                        <KeyframeField
                          label="Amt"
                          help={animFxHelp(effect.kind, 'Amt')}
                          value={effect.intensity}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(next) =>
                            patchEffect(selected, effect.id, { intensity: next })
                          }
                        />
                        <KeyframeField
                          label="Spd"
                          help={animFxHelp(effect.kind, 'Spd')}
                          value={effect.speed}
                          min={0.05}
                          max={8}
                          step={0.05}
                          onChange={(next) => patchEffect(selected, effect.id, { speed: next })}
                        />
                        <KeyframeField
                          label="Phase"
                          help={animFxHelp(effect.kind, 'Phase')}
                          value={effect.phase}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(next) => patchEffect(selected, effect.id, { phase: next })}
                        />
                      </div>
                      <div className="keyframe-fields effect-fields envelope-fields">
                        <KeyframeField
                          label="Start"
                          help={animFxHelp(effect.kind, 'Start')}
                          value={effect.envelopeStart * 100}
                          min={0}
                          max={100}
                          step={1}
                          onChange={(next) =>
                            patchEffect(selected, effect.id, { envelopeStart: next / 100 })
                          }
                        />
                        <KeyframeField
                          label="End"
                          help={animFxHelp(effect.kind, 'End')}
                          value={effect.envelopeEnd * 100}
                          min={0}
                          max={100}
                          step={1}
                          onChange={(next) =>
                            patchEffect(selected, effect.id, { envelopeEnd: next / 100 })
                          }
                        />
                        <KeyframeField
                          label="Fade In"
                          help={ANIM_FX_FIELD_HELP['Fade In']}
                          value={effect.fadeIn}
                          min={0}
                          max={0.5}
                          step={0.01}
                          onChange={(next) => patchEffect(selected, effect.id, { fadeIn: next })}
                        />
                        <KeyframeField
                          label="Fade Out"
                          help={ANIM_FX_FIELD_HELP['Fade Out']}
                          value={effect.fadeOut}
                          min={0}
                          max={0.5}
                          step={0.01}
                          onChange={(next) => patchEffect(selected, effect.id, { fadeOut: next })}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <small className="keyframe-hint">
                Procedural motion on top of keyframes — transform, canvas, shader, and text effects.
              </small>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="KEYFRAMES" storageKey="overlay-keyframes">
            <div className="keyframe-actions">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => addKeyframe(selected, timeline)}
                title="Store this layer's current position and opacity at the playhead"
              >
                + Keyframe @ {Math.round(timeline * 100)}%
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
              <>
                <small className="keyframe-hint">
                  Scrub the preview to a frame, then drag the layer to edit its keyframe there.
                </small>
                <ul className="keyframe-list">
                  {selected.keyframes.map((kf, index) => (
                    <li key={kf.id ?? index} className="keyframe-item">
                      <div className="keyframe-row-head">
                        <span className="keyframe-index">#{index + 1}</span>
                        <button
                          type="button"
                          className="btn btn-small keyframe-remove"
                          onClick={() => kf.id && deleteKeyframe(selected, kf.id)}
                          title="Remove this keyframe"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="keyframe-fields">
                        <KeyframeField
                          label="t %"
                          value={kf.t * 100}
                          min={0}
                          max={100}
                          step={0.5}
                          onChange={(next) =>
                            kf.id && patchKeyframe(selected, kf.id, { t: next / 100 })
                          }
                        />
                        <KeyframeField
                          label="x"
                          value={kf.x ?? selected.x}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(next) => kf.id && patchKeyframe(selected, kf.id, { x: next })}
                        />
                        <KeyframeField
                          label="y"
                          value={kf.y ?? selected.y}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(next) => kf.id && patchKeyframe(selected, kf.id, { y: next })}
                        />
                        <KeyframeField
                          label="α"
                          value={kf.opacity ?? selected.opacity}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(next) =>
                            kf.id && patchKeyframe(selected, kf.id, { opacity: next })
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
