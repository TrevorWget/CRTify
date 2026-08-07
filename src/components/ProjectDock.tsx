import { useRef } from 'react';
import { CollapsibleSection } from './CollapsibleSection';

interface ProjectDockProps {
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
  onCopyShareLink: () => void;
}

export function ProjectDock({ onSaveProject, onLoadProject, onCopyShareLink }: ProjectDockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onLoadProject(file);
    event.target.value = '';
  };

  return (
    <CollapsibleSection title="PROJECT" storageKey="project-dock">
      <div className="project-dock">
        <div className="project-dock-actions">
          <button type="button" className="btn btn-small" onClick={onSaveProject}>
            Save project
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => fileInputRef.current?.click()}
          >
            Load project
          </button>
          <button type="button" className="btn btn-small" onClick={onCopyShareLink}>
            Copy look link
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={handleFileChange}
        />
        <p className="project-dock-hint">Media must be reattached after loading a project.</p>
      </div>
    </CollapsibleSection>
  );
}
