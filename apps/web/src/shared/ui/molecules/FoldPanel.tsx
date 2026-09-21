import { useId, useState, type ReactNode } from 'react';
import './fold-panel.css';

interface FoldPanelProps {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Registros densos (expediente de cliente, historial de estación) se
 * despliegan como un legajo que se desdobla desde el pliegue superior
 * — un giro real en el eje X con perspectiva, no un acordeón que
 * desliza verticalmente con un chevron disfrazado.
 */
export function FoldPanel({ label, defaultOpen = false, children }: FoldPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={`fold-panel ${open ? 'fold-panel--open' : ''}`}>
      <button
        type="button"
        className="fold-panel__pull"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="fold-panel__tab" aria-hidden="true" />
        {label}
      </button>
      <div className="fold-panel__crease" aria-hidden="true" />
      <div className="fold-panel__stage" aria-hidden={!open}>
        <div id={panelId} className="fold-panel__leaf">
          <div className="fold-panel__body">{children}</div>
        </div>
      </div>
    </div>
  );
}
