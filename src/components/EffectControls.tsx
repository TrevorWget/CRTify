import type { CrtSettings } from '../types/crt';

interface EffectControlsProps {
  settings: CrtSettings;
  onChange: (settings: CrtSettings) => void;
  onReset: () => void;
  crtAffectText: boolean;
  onCrtAffectTextChange: (value: boolean) => void;
}

function Slider({
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
  onChange: (v: number) => void;
}) {
  return (
    <label className="control-row">
      <span className="control-label">
        {label}
        <span className="control-value">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function EffectControls({
  settings,
  onChange,
  onReset,
  crtAffectText,
  onCrtAffectTextChange,
}: EffectControlsProps) {
  const update = (partial: Partial<CrtSettings>) => onChange({ ...settings, ...partial });

  return (
    <div className="effect-controls">
      <div className="section-heading">
        <h3>CRT Effects</h3>
        <button type="button" className="btn btn-small" onClick={onReset}>
          Defaults
        </button>
      </div>

      <Slider
        label="Curvature"
        value={settings.curvature}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ curvature: v })}
      />
      <Slider
        label="Scanline Intensity"
        value={settings.scanlineIntensity}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ scanlineIntensity: v })}
      />
      <Slider
        label="Scanline Count"
        value={settings.scanlineCount}
        min={50}
        max={800}
        step={10}
        onChange={(v) => update({ scanlineCount: v })}
      />
      <Slider
        label="Chromatic Aberration"
        value={settings.aberration}
        min={0}
        max={0.02}
        step={0.0005}
        onChange={(v) => update({ aberration: v })}
      />
      <Slider
        label="Vignette"
        value={settings.vignette}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ vignette: v })}
      />
      <Slider
        label="Noise"
        value={settings.noise}
        min={0}
        max={0.3}
        step={0.01}
        onChange={(v) => update({ noise: v })}
      />
      <Slider
        label="Bloom"
        value={settings.bloom}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ bloom: v })}
      />
      <Slider
        label="Tint Strength"
        value={settings.tintStrength}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ tintStrength: v })}
      />
      <label className="control-row">
        <span className="control-label">Phosphor Tint</span>
        <input
          type="color"
          value={settings.tint}
          onChange={(e) => update({ tint: e.target.value })}
        />
      </label>
      <Slider
        label="Brightness"
        value={settings.brightness}
        min={0.5}
        max={2}
        step={0.01}
        onChange={(v) => update({ brightness: v })}
      />
      <Slider
        label="Contrast"
        value={settings.contrast}
        min={0.5}
        max={2}
        step={0.01}
        onChange={(v) => update({ contrast: v })}
      />
      <label className="control-row toggle-row">
        <span className="control-label">Flicker</span>
        <input
          type="checkbox"
          checked={settings.flicker}
          onChange={(e) => update({ flicker: e.target.checked })}
        />
      </label>
      {settings.flicker && (
        <Slider
          label="Flicker Intensity"
          value={settings.flickerIntensity}
          min={0}
          max={0.2}
          step={0.005}
          onChange={(v) => update({ flickerIntensity: v })}
        />
      )}
      <label className="control-row toggle-row">
        <span className="control-label">CRT-affect text</span>
        <input
          type="checkbox"
          checked={crtAffectText}
          onChange={(e) => onCrtAffectTextChange(e.target.checked)}
        />
      </label>
    </div>
  );
}
