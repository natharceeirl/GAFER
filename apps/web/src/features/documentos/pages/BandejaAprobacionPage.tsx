import { useMemo, useState } from 'react';
import type { EstadoDocumento } from '@gafer/contracts';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { EstadoBadge } from '../components/EstadoBadge';
import type { DocumentoResumen } from '../model/tipos';
import './bandeja-aprobacion-page.css';

const FILTROS: Array<{ id: 'TODOS' | EstadoDocumento; etiqueta: string }> = [
  { id: 'TODOS', etiqueta: 'Todos' },
  { id: 'ENVIADO_A_REVISION', etiqueta: 'En revisión' },
  { id: 'OBSERVADO', etiqueta: 'Observado' },
  { id: 'APROBADO', etiqueta: 'Aprobado' },
  { id: 'ENVIADO', etiqueta: 'Enviado' },
];

interface BandejaAprobacionPageProps {
  /** Documentos de campo recién enviados a revisión, seguidos de los de ejemplo. */
  documentos: DocumentoResumen[];
  onAbrirDocumento?: (id: string) => void;
}

export function BandejaAprobacionPage({ documentos: todos, onAbrirDocumento }: BandejaAprobacionPageProps) {
  const [filtro, setFiltro] = useState<'TODOS' | EstadoDocumento>('TODOS');

  const documentos = useMemo(() => (filtro === 'TODOS' ? todos : todos.filter((d) => d.estado === filtro)), [todos, filtro]);

  const pendientes = todos.filter((d) => d.estado === 'ENVIADO_A_REVISION').length;

  return (
    <div className="bandeja-page">
      <TicketHeader
        code={`${pendientes} pendientes`}
        title="Bandeja de aprobación"
        meta="Documentos generados en campo, ordenados por fecha"
      />

      <div className="bandeja-page__body">
        <div className="bandeja-filtros" role="tablist" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filtro === f.id}
              className={`bandeja-filtro ${filtro === f.id ? 'bandeja-filtro--activo' : ''}`}
              onClick={() => setFiltro(f.id)}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        {documentos.length === 0 ? (
          <p className="bandeja-empty">Ningún documento en este estado.</p>
        ) : (
          <ul className="bandeja-lista">
            {documentos.map((d, i) => (
              <li key={d.id}>
                <button type="button" className="bandeja-fila" onClick={() => onAbrirDocumento?.(d.id)}>
                  <span className="bandeja-fila__codigo tabular">{d.codigo}</span>
                  <span className="bandeja-fila__cliente">
                    {d.cliente} <span className="bandeja-fila__proyecto">· {d.proyecto}</span>
                  </span>
                  <span className="bandeja-fila__tipo">{d.tipo}</span>
                  <EstadoBadge estado={d.estado} />
                  <span className="bandeja-fila__fecha tabular">{d.fecha}</span>
                </button>
                {i < documentos.length - 1 && <PerforatedDivider />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
