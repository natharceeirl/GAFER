import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { FoldPanel } from '../../../shared/ui/molecules/FoldPanel';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import type { ClienteFila } from '../model/clientes-mock';
import { ALERTAS_VENCIMIENTO_MOCK, HISTORIAL_MOCK, PDFS_MOCK, PROYECTOS_MOCK } from '../model/expediente-mock';
import './cliente-expediente-page.css';

interface Props {
  cliente: ClienteFila;
  onVolver: () => void;
}

export function ClienteExpedientePage({ cliente, onVolver }: Props) {
  const proyectosActivos = PROYECTOS_MOCK.filter((p) => p.estado === 'ACTIVO');
  const proyectosInactivos = PROYECTOS_MOCK.filter((p) => p.estado === 'INACTIVO');

  return (
    <div className="expediente-page">
      <TicketHeader
        code={`${cliente.codigoCorto} · RUC ${cliente.ruc}`}
        title={cliente.razonSocial}
        meta={`${cliente.giro} · expediente digital`}
        action={
          <button type="button" className="expediente-page__volver" onClick={onVolver}>
            ← Volver a la cartera
          </button>
        }
      />

      <div className="expediente-page__body">
        {ALERTAS_VENCIMIENTO_MOCK.length > 0 && (
          <div className="expediente-alerta">
            {ALERTAS_VENCIMIENTO_MOCK.map((a) => (
              <p key={a.documento}>
                <strong>{a.proyecto}</strong> — {a.documento} vence el{' '}
                {new Date(a.vence).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            ))}
          </div>
        )}

        <FoldPanel label={`Proyectos activos (${proyectosActivos.length})`} defaultOpen>
          <ul className="expediente-proyectos">
            {proyectosActivos.map((p) => (
              <li key={p.id} className="expediente-proyecto">
                <div className="expediente-proyecto__cabecera">
                  <span className="expediente-proyecto__nombre">{p.nombre}</span>
                  <span className="expediente-proyecto__direccion">{p.direccion}</span>
                </div>
                <ul className="expediente-proyecto__servicios">
                  {p.servicios.map((s) => (
                    <li key={s.tipo}>
                      {s.tipo} <span className="expediente-proyecto__frecuencia">· {s.frecuencia}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </FoldPanel>

        {proyectosInactivos.length > 0 && (
          <FoldPanel label={`Proyectos inactivos (${proyectosInactivos.length})`}>
            <ul className="expediente-proyectos">
              {proyectosInactivos.map((p) => (
                <li key={p.id} className="expediente-proyecto expediente-proyecto--inactivo">
                  <div className="expediente-proyecto__cabecera">
                    <span className="expediente-proyecto__nombre">{p.nombre}</span>
                    <span className="expediente-proyecto__direccion">{p.direccion}</span>
                  </div>
                </li>
              ))}
            </ul>
          </FoldPanel>
        )}

        <FoldPanel label="Historial cronológico de servicios">
          <ul className="expediente-historial">
            {HISTORIAL_MOCK.map((h, i) => (
              <li key={h.documento}>
                <div className="expediente-historial__fila">
                  <span className="expediente-historial__fecha tabular">
                    {new Date(h.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="expediente-historial__proyecto">{h.proyecto}</span>
                  <span className="expediente-historial__tipo">{h.tipo}</span>
                  <span className="expediente-historial__tecnico">{h.tecnico}</span>
                  <span className="expediente-historial__doc">{h.documento}</span>
                </div>
                {i < HISTORIAL_MOCK.length - 1 && <PerforatedDivider />}
              </li>
            ))}
          </ul>
        </FoldPanel>

        <FoldPanel label={`Carpeta de PDF (${PDFS_MOCK.length})`}>
          <ul className="expediente-pdfs">
            {PDFS_MOCK.map((f) => (
              <li key={f.nombre} className="expediente-pdf">
                <span className="expediente-pdf__nombre">{f.nombre}</span>
                <span className="expediente-pdf__ruta">{f.ruta}</span>
              </li>
            ))}
          </ul>
        </FoldPanel>
      </div>
    </div>
  );
}
