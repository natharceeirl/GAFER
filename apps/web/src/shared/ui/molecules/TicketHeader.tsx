import type { ReactNode } from 'react';
import './ticket-header.css';

interface TicketHeaderProps {
  /** Código de ticket, ej. INFORME-KALLPA-014-2026 */
  code: string;
  title: string;
  meta: string;
  action?: ReactNode;
}

/**
 * Franja de boleto fija en la parte superior de cada pantalla —
 * la identidad (cliente · proyecto · servicio · fecha) nunca se pierde
 * de vista, como el talón de un ticket real.
 */
export function TicketHeader({ code, title, meta, action }: TicketHeaderProps) {
  return (
    <header className="ticket-header">
      <div className="ticket-header__stub">
        <span className="ticket-header__code">{code}</span>
        <h1 className="ticket-header__title">{title}</h1>
        <p className="ticket-header__meta">{meta}</p>
      </div>
      {action ? <div className="ticket-header__action">{action}</div> : null}
    </header>
  );
}
