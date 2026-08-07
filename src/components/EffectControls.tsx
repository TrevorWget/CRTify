import { defaultCrtSettings, type CrtPreset, type CrtSettings } from '../types/crt';
import { CollapsibleSection } from './CollapsibleSection';
import { PresetRack } from './PresetRack';

interface EffectControlsProps {
  settings: CrtSettings;
  onChange: (settings: CrtSettings) => void;
  onReset: () => void;
  crtAffectText: boolean;
  onCrtAffectTextChange: (value: boolean) => void;
  onApplyPreset: (preset: CrtPreset) => void;
}

const EFFECT_HELP: Record<string, string> = {
  Curvature: 'Barrel-warps the image like a curved CRT glass face.',
  'Scanline Intensity': 'How dark the horizontal phosphor scanlines appear.',
  'Scanline Count': 'How many horizontal scanlines are drawn across the frame.',
  'Chromatic Aberration': 'Splits red/blue channels at the edges for a misaligned lens look.',
  Vignette: 'Darkens the corners to mimic a tube monitor falloff.',
  Noise: 'Adds analog grain / static on top of the picture.',
  Bloom: 'Soft glow around bright areas, like overdriven phosphors.',
  'Tint Strength': 'How strongly the phosphor tint colors the whole image.',
  'Phosphor Tint': 'Base glow color mixed into the picture (amber, green, etc.).',
  Brightness: 'Overall picture brightness after CRT processing.',
  Contrast: 'Expands or flattens the tonal range of the picture.',
  Flicker: 'Subtle brightness pulsing like an unstable CRT power supply.',
  'Flicker Intensity': 'How strong the flicker pulse is when flicker is enabled.',
  'CRT-affect text': 'Also run overlay layers through the CRT shader stack.',
  'RGB Mask': 'Aperture-grille / shadow-mask RGB stripe pattern over the screen.',
  Interlace: 'Darkens alternate fields for a broadcast interlaced look.',
  'Roll Bar': 'Vertical rolling sync bar that drifts through the frame.',
  'Phosphor Decay': 'Ghosting / persistence trail from previous phosphor glow.',
  'Show Bezel': 'Composite a TV chrome bezel around exported frames.',
};

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
  const help = EFFECT_HELP[label];
  return (
    <div className="control-row" title={help}>
      <span className="control-label">
        <button
          type="button"
          className="effect-reset-label"
          onClick={onReset}
          title={help ? `${help} Click to reset.` : 'Reset to default'}
        >
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
        title={help}
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
  onApplyPreset,
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

      <CollapsibleSection title="CRT CORE" storageKey="crt-core">
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
        <div className="control-row" title={EFFECT_HELP['Phosphor Tint']}>
          <span className="control-label">
            <button
              type="button"
              className="effect-reset-label"
              onClick={() => update({ tint: defaultCrtSettings.tint })}
              title={`${EFFECT_HELP['Phosphor Tint']} Click to reset.`}
            >
              Phosphor Tint
            </button>
          </span>
          <input
            type="color"
            value={settings.tint}
            title={EFFECT_HELP['Phosphor Tint']}
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
        <div className="control-row toggle-row" title={EFFECT_HELP.Flicker}>
          <span className="control-label">
            <button
              type="button"
              className="effect-reset-label"
              onClick={() => update({ flicker: defaultCrtSettings.flicker })}
              title={`${EFFECT_HELP.Flicker} Click to reset.`}
            >
              Flicker
            </button>
          </span>
          <input
            type="checkbox"
            checked={settings.flicker}
            title={EFFECT_HELP.Flicker}
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
        <div className="control-row toggle-row" title={EFFECT_HELP['CRT-affect text']}>
          <span className="control-label">
            <button
              type="button"
              className="effect-reset-label"
              onClick={() => onCrtAffectTextChange(false)}
              title={`${EFFECT_HELP['CRT-affect text']} Click to reset.`}
            >
              CRT-affect overlays
            </button>
          </span>
          <input
            type="checkbox"
            checked={crtAffectText}
            title={EFFECT_HELP['CRT-affect text']}
            onChange={(e) => onCrtAffectTextChange(e.target.checked)}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="PHOSPHOR / MASK" storageKey="crt-phosphor">
        <Slider
          label="RGB Mask"
          value={settings.rgbMask}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => update({ rgbMask: v })}
          onReset={() => update({ rgbMask: defaultCrtSettings.rgbMask })}
        />
        <Slider
          label="Interlace"
          value={settings.interlace}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => update({ interlace: v })}
          onReset={() => update({ interlace: defaultCrtSettings.interlace })}
        />
        <Slider
          label="Roll Bar"
          value={settings.rollBar}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => update({ rollBar: v })}
          onReset={() => update({ rollBar: defaultCrtSettings.rollBar })}
        />
        <Slider
          label="Phosphor Decay"
          value={settings.phosphorDecay}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => update({ phosphorDecay: v })}
          onReset={() => update({ phosphorDecay: defaultCrtSettings.phosphorDecay })}
        />
        <div className="control-row toggle-row" title={EFFECT_HELP['Show Bezel']}>
          <span className="control-label">
            <button
              type="button"
              className="effect-reset-label"
              onClick={() => update({ showBezel: defaultCrtSettings.showBezel })}
              title={`${EFFECT_HELP['Show Bezel']} Click to reset.`}
            >
              Show Bezel
            </button>
          </span>
          <input
            type="checkbox"
            checked={settings.showBezel}
            title={EFFECT_HELP['Show Bezel']}
            onChange={(e) => update({ showBezel: e.target.checked })}
          />
        </div>
      </CollapsibleSection>

      <PresetRack
        settings={settings}
        crtAffectText={crtAffectText}
        onApply={onApplyPreset}
      />
    </div>
  );
}
