import { useCallback, useState } from 'react';
import type { CrtPreset, CrtSettings } from '../types/crt';
import { deleteCustomPreset, listPresets, saveCustomPreset } from '../utils/presets';

interface PresetRackProps {
  settings: CrtSettings;
  crtAffectText: boolean;
  onApply: (preset: CrtPreset) => void;
  onPresetsChanged?: () => void;
}

export function PresetRack({ settings, crtAffectText, onApply, onPresetsChanged }: PresetRackProps) {
  const [presets, setPresets] = useState<CrtPreset[]>(() => listPresets());
  const [presetName, setPresetName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setPresets(listPresets());
    onPresetsChanged?.();
  }, [onPresetsChanged]);

  const handleApply = (preset: CrtPreset) => {
    setActiveId(preset.id);
    onApply(preset);
  };

  const handleSave = () => {
    const name = presetName.trim() || 'Custom Look';
    saveCustomPreset(name, settings, crtAffectText);
    setPresetName('');
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteCustomPreset(id);
    if (activeId === id) setActiveId(null);
    refresh();
  };

  return (
    <div className="preset-rack">
      <div className="control-divider">LOOK PRESETS</div>
      <div className="segmented-control wrap preset-rack-list">
        {presets.map((preset) => (
          <span key={preset.id} className="preset-rack-item">
            <button
              type="button"
              className={activeId === preset.id ? 'active' : ''}
              onClick={() => handleApply(preset)}
              title={preset.description ?? `${preset.name} look preset`}
            >
              {preset.name}
            </button>
            {!preset.builtin && (
              <button
                type="button"
                className="btn-icon btn-danger preset-delete"
                onClick={() => handleDelete(preset.id)}
                title={`Delete ${preset.name}`}
                aria-label={`Delete ${preset.name}`}
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
          placeholder="Preset name"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
        />
        <button type="button" className="btn btn-small" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}
