import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  /** When set, open/closed state is remembered across reloads. */
  storageKey?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

function readStoredOpen(storageKey: string | undefined, defaultOpen: boolean): boolean {
  if (!storageKey || typeof localStorage === 'undefined') return defaultOpen;
  try {
    const saved = localStorage.getItem(`crtify-section:${storageKey}`);
    if (saved === null) return defaultOpen;
    return saved === '1';
  } catch {
    return defaultOpen;
  }
}

export function CollapsibleSection({
  title,
  storageKey,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(() => readStoredOpen(storageKey, defaultOpen));

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      if (storageKey) {
        try {
          localStorage.setItem(`crtify-section:${storageKey}`, next ? '1' : '0');
        } catch {
          /* ignore quota / private mode */
        }
      }
      return next;
    });
  };

  return (
    <section className={`collapsible-section${open ? '' : ' is-collapsed'}`}>
      <button
        type="button"
        className="control-divider control-divider-toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="control-divider-label">{title}</span>
        <span className="control-divider-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div className="collapsible-section-body">{children}</div> : null}
    </section>
  );
}
