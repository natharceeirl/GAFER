import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { FoldPanel } from '../../../shared/ui/molecules/FoldPanel';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { Button } from '../../../shared/ui/atoms/Button';
import type { ClienteFila } from '../model/clientes-mock';
import { ALERTAS_VENCIMIENTO_MOCK, HISTORIAL_MOCK, PDFS_MOCK, type ProyectoExpediente } from '../model/expediente-mock';
import './cliente-expediente-page.css';

interface Props {
  cliente: ClienteFila;
  proyectos: ProyectoExpediente[];
  /** Cliente recién dado de alta: todavía no tiene historial, PDF ni alertas. */
  sinHistorial: boolean;
  puedeDarDeAlta: boolean;
  aviso: string | null;
  onVolver: () => void;
  onNuevoProyecto: () => void;
  onNuevoServicio: (proyectoId: string) => void;
}

export function ClienteExpedientePage({
  cliente,
  proyectos,
  sinHistorial,
  puedeDarDeAlta,
  aviso,
  onVolver,
  onNuevoProyecto,
  onNuevoServicio,
}: Props) {
  const proyectosActivos = proyectos.filter((p) => p.estado === 'ACTIVO');
  const proyectosInactivos = proyectos.filter((p) => p.estado === 'INACTIVO');
  const historial = sinHistorial ? [] : HISTORIAL_MOCK;
  const pdfs = sinHistorial ? [] : PDFS_MOCK;
  const alertas = sinHistorial ? [] : ALERTAS_VENCIMIENTO_MOCK;

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
        {aviso ? (
          <p className="expediente-aviso" role="status">
            {aviso}
          </p>
        ) : null}

        {alertas.length > 0 && (
          <div className="expediente-alerta">
            {alertas.map((a) => (
              <p key={a.documento}>
                <strong>{a.proyecto}</strong> — {a.documento} vence el{' '}
                {new Date(a.vence).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            ))}
          </div>
        )}

        {puedeDarDeAlta ? (
          <div className="expediente-acciones">
            <Button variant="secondary" onClick={onNuevoProyecto}>
              Nueva sede
            </Button>
          </div>
        ) : null}

        <FoldPanel label={`Proyectos activos (${proyectosActivos.length})`} defaultOpen>
          {proyectosActivos.length === 0 ? (
            <p className="expediente-vacio">
              {puedeDarDeAlta
                ? 'Este cliente todavía no tiene sedes. Registre la primera con «Nueva sede».'
                : 'Este cliente todavía no tiene sedes activas.'}
            </p>
          ) : (
            <ul className="expediente-proyectos">
              {proyectosActivos.map((p) => (
                <li key={p.id} className="expediente-proyecto">
                  <div className="expediente-proyecto__cabecera">
                    <span className="expediente-proyecto__nombre">{p.nombre}</span>
                    <span className="expediente-proyecto__direccion">
                      {p.direccion}
                      {p.distrito ? `, ${p.distrito}` : ''}
                    </span>
                    {puedeDarDeAlta ? (
                      <button type="button" className="expediente-proyecto__agregar" onClick={() => onNuevoServicio(p.id)}>
                        + Servicio
                      </button>
                    ) : null}
                  </div>
                  {p.servicios.length === 0 ? (
                    <p className="expediente-proyecto__sin-servicios">Sin servicios contratados todavía.</p>
                  ) : (
                    <ul className="expediente-proyecto__servicios">
                      {p.servicios.map((s) => (
                        <li key={s.id}>
                          {s.tipo} <span className="expediente-proyecto__frecuencia">· {s.frecuencia}</span>
                          {s.requiereCertificado ? <span className="expediente-proyecto__frecuencia"> · con certificado</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
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
          {historial.length === 0 ? (
            <p className="expediente-vacio">Sin servicios ejecutados todavía.</p>
          ) : (
            <ul className="expediente-historial">
              {historial.map((h, i) => (
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
                  {i < historial.length - 1 && <PerforatedDivider />}
                </li>
              ))}
            </ul>
          )}
        </FoldPanel>

        <FoldPanel label={`Carpeta de PDF (${pdfs.length})`}>
          {pdfs.length === 0 ? (
            <p className="expediente-vacio">Todavía no hay documentos aprobados para este cliente.</p>
          ) : (
            <ul className="expediente-pdfs">
              {pdfs.map((f) => (
                <li key={f.nombre} className="expediente-pdf">
                  <span className="expediente-pdf__nombre">{f.nombre}</span>
                  <span className="expediente-pdf__ruta">{f.ruta}</span>
                </li>
              ))}
            </ul>
          )}
        </FoldPanel>
      </div>
    </div>
  );
}
