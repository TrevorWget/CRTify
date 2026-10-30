import { listSceneKits, type SceneKit } from '../utils/sceneKits';
import { CollapsibleSection } from './CollapsibleSection';

interface SceneKitRackProps {
  onApply: (kit: SceneKit) => void;
}

export function SceneKitRack({ onApply }: SceneKitRackProps) {
  const kits = listSceneKits();

  return (
    <CollapsibleSection title="SCENE KITS" storageKey="scene-kits">
      <div className="preset-rack">
        <small className="control-hint">
          One-click looks with sample overlays and matching Anim FX. Replaces the current overlay
          stack.
        </small>
        <div className="segmented-control wrap preset-rack-list">
          {kits.map((kit) => (
            <button
              key={kit.id}
              type="button"
              title={kit.description}
              onClick={() => onApply(kit)}
            >
              {kit.name}
            </button>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}
