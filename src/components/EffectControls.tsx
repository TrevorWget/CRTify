import { defaultCrtSettings, type CrtSettings } from '../types/crt';

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
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="control-row">
      <span className="control-label">
        <button type="button" className="effect-reset-label" onClick={onReset} title="Reset to default">
          {label}
        </button>
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
    </div>
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
        onReset={() => update({ curvature: defaultCrtSettings.curvature })}
      />
      <Slider
        label="Scanline Intensity"
        value={settings.scanlineIntensity}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ scanlineIntensity: v })}
        onReset={() => update({ scanlineIntensity: defaultCrtSettings.scanlineIntensity })}
      />
      <Slider
        label="Scanline Count"
        value={settings.scanlineCount}
        min={50}
        max={800}
        step={10}
        onChange={(v) => update({ scanlineCount: v })}
        onReset={() => update({ scanlineCount: defaultCrtSettings.scanlineCount })}
      />
      <Slider
        label="Chromatic Aberration"
        value={settings.aberration}
        min={0}
        max={0.02}
        step={0.0005}
        onChange={(v) => update({ aberration: v })}
        onReset={() => update({ aberration: defaultCrtSettings.aberration })}
      />
      <Slider
        label="Vignette"
        value={settings.vignette}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ vignette: v })}
        onReset={() => update({ vignette: defaultCrtSettings.vignette })}
      />
      <Slider
        label="Noise"
        value={settings.noise}
        min={0}
        max={0.3}
        step={0.01}
        onChange={(v) => update({ noise: v })}
        onReset={() => update({ noise: defaultCrtSettings.noise })}
      />
      <Slider
        label="Bloom"
        value={settings.bloom}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ bloom: v })}
        onReset={() => update({ bloom: defaultCrtSettings.bloom })}
      />
      <Slider
        label="Tint Strength"
        value={settings.tintStrength}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ tintStrength: v })}
        onReset={() => update({ tintStrength: defaultCrtSettings.tintStrength })}
      />
      <div className="control-row">
        <span className="control-label">
          <button
            type="button"
            className="effect-reset-label"
            onClick={() => update({ tint: defaultCrtSettings.tint })}
            title="Reset to default"
          >
            Phosphor Tint
          </button>
        </span>
        <input
          type="color"
          value={settings.tint}
          onChange={(e) => update({ tint: e.target.value })}
        />
      </div>
      <Slider
        label="Brightness"
        value={settings.brightness}
        min={0.5}
        max={2}
        step={0.01}
        onChange={(v) => update({ brightness: v })}
        onReset={() => update({ brightness: defaultCrtSettings.brightness })}
      />
      <Slider
        label="Contrast"
        value={settings.contrast}
        min={0.5}
        max={2}
        step={0.01}
        onChange={(v) => update({ contrast: v })}
        onReset={() => update({ contrast: defaultCrtSettings.contrast })}
      />
      <div className="control-row toggle-row">
        <span className="control-label">
          <button
            type="button"
            className="effect-reset-label"
            onClick={() => update({ flicker: defaultCrtSettings.flicker })}
            title="Reset to default"
          >
            Flicker
          </button>
        </span>
        <input
          type="checkbox"
          checked={settings.flicker}
          onChange={(e) => update({ flicker: e.target.checked })}
        />
      </div>
      {settings.flicker && (
        <Slider
          label="Flicker Intensity"
          value={settings.flickerIntensity}
          min={0}
          max={0.2}
          step={0.005}
          onChange={(v) => update({ flickerIntensity: v })}
          onReset={() => update({ flickerIntensity: defaultCrtSettings.flickerIntensity })}
        />
      )}
      <div className="control-row toggle-row">
        <span className="control-label">
          <button
            type="button"
            className="effect-reset-label"
            onClick={() => onCrtAffectTextChange(false)}
            title="Reset to default"
          >
            CRT-affect text
          </button>
        </span>
        <input
          type="checkbox"
          checked={crtAffectText}
          onChange={(e) => onCrtAffectTextChange(e.target.checked)}
        />
      </div>
    </div>
  );
}
