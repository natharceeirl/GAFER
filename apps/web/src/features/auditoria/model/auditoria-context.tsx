import { createContext, useContext, useState, type ReactNode } from 'react';
import type { EventoAuditoria } from './evento';

const EVENTOS_INICIALES: EventoAuditoria[] = [
  { id: 'e1', fechaHora: '2026-09-10 17:42', usuario: 'r.agarate', rol: 'ADMINISTRADOR', accion: 'Envío al cliente', referencia: 'REPORTE-VARIOS-118-2026', detalle: 'REPORTE-VARIOS-118-2026.pdf' },
  { id: 'e2', fechaHora: '2026-09-12 16:05', usuario: 'd.amamani', rol: 'SUPERVISOR', accion: 'Aprobación', referencia: 'INFORME-PETROPERU-002-2026', detalle: '6 fotos en el PDF · genera INFORME-PETROPERU-002-2026.pdf y CERT-PETROPERU-002-2026.pdf' },
  { id: 'e3', fechaHora: '2026-09-14 11:20', usuario: 'd.amamani', rol: 'SUPERVISOR', accion: 'Observación', referencia: 'INFORME-SAMAY-031-2026', detalle: 'Falta fotografía de estación 09 y el detalle de la zona de carga.' },
  { id: 'e4', fechaHora: '2026-09-15 09:48', usuario: 'm.ipusari', rol: 'TECNICO_OPERADOR', accion: 'Cierre de inspección', referencia: 'INFORME-KALLPA-014-2026', detalle: 'Cerrado en la app Android; pasa a revisión automáticamente' },
];

interface AuditoriaContexto {
  eventos: EventoAuditoria[];
  registrar: (...eventos: EventoAuditoria[]) => void;
}

const Contexto = createContext<AuditoriaContexto | null>(null);

/** Log de auditoría (§8.4): solo se agregan eventos; no hay forma de editarlos ni borrarlos. */
export function AuditoriaProvider({ children }: { children: ReactNode }) {
  const [eventos, setEventos] = useState<EventoAuditoria[]>(EVENTOS_INICIALES);
  return (
    <Contexto.Provider value={{ eventos, registrar: (...nuevos) => setEventos((prev) => [...prev, ...nuevos]) }}>{children}</Contexto.Provider>
  );
}

export function useAuditoria(): AuditoriaContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAuditoria debe usarse dentro de AuditoriaProvider');
  return ctx;
}
