import { useMemo, useState } from 'react';
import type { ColorAura } from '@gafer/contracts';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { Badge } from '../../../shared/ui/atoms/Badge';
import { Button } from '../../../shared/ui/atoms/Button';
import { fechaLocal } from '../../../shared/lib/fecha';
import { NOMBRE_ROL, type Rol } from '../../auth/model/roles';
import { EstadoBadge } from '../../documentos/components/EstadoBadge';
import type { DocumentoResumen } from '../../documentos/model/tipos';
import { useCartera } from '../../cliente-expediente/model/cartera-context';
import { proyectosDe } from '../../cliente-expediente/model/cartera';
import { useProgramacion } from '../../programacion/model/programacion-context';
import { agendaDelDia, type EstadoCampo } from '../../programacion/model/programacion';
import { PERSONAL_MOCK } from '../../mantenimiento/model/mantenimiento-mock';
import { alertasActivas, clientesSinServicio, type Alerta } from '../model/estadisticas';
import { ESTACIONES_ROJO, generarHistorial, vencimientosDe } from '../model/historial-mock';
import { EstadisticasPanel } from '../components/EstadisticasPanel';
import { ResumenClientes } from '../components/ResumenClientes';
import { ControlActividades } from '../components/ControlActividades';
import { AlertasResumen } from '../components/AlertasResumen';
import './dashboard-page.css';

type Pestana = 'hoy' | 'estadisticas' | 'clientes' | 'actividades';

const PESTANAS: Array<{ id: Pestana; etiqueta: string }> = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: 'estadisticas', etiqueta: 'Estadísticas' },
  { id: 'clientes', etiqueta: 'Resumen de clientes' },
  { id: 'actividades', etiqueta: 'Control de actividades' },
];

const ESTADO_VISITA: Record<EstadoCampo, { etiqueta: string; color: ColorAura }> = {
  PENDIENTE: { etiqueta: 'Pendiente', color: 'SIN_COLOR' },
  EN_CURSO: { etiqueta: 'En curso', color: 'AMARILLO' },
  EN_REVISION: { etiqueta: 'Cerrado', color: 'VERDE' },
};

interface DashboardPageProps {
  /** El dashboard es exclusivo de Administrador y Supervisor — spec §10.1. */
  rol: Rol;
  documentos: DocumentoResumen[];
  onAbrirDocumento: (id: string) => void;
}

function exportarAlertas(alertas: Alerta[], hoy: string) {
  const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const filas = [['Severidad', 'Alerta', 'Detalle'], ...alertas.map((a) => [a.severidad, a.texto, a.detalle])];
  const csv = filas.map((f) => f.map(escapar).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `alertas-gafer-${hoy}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

/**
 * Dashboard (§11): la pestaña "Hoy" es la vista por defecto (alertas,
 * servicios del día, pendientes); el resto cubre las estadísticas de §10.1,
 * el resumen de clientes y el control de actividades, con filtros.
 */
export function DashboardPage({ rol, documentos, onAbrirDocumento }: DashboardPageProps) {
  const hoy = fechaLocal();
  const { cartera } = useCartera();
  const { visitas } = useProgramacion();
  const [pestana, setPestana] = useState<Pestana>('hoy');
  const historial = useMemo(() => generarHistorial(hoy), [hoy]);

  const pendientes = documentos.filter((d) => d.estado === 'ENVIADO_A_REVISION');
  const alertas = alertasActivas({
    hoy,
    vencimientos: vencimientosDe(cartera.clientes),
    estaciones: ESTACIONES_ROJO,
    pendientes,
    sinServicio: clientesSinServicio(historial, cartera.clientes, hoy, null),
  });

  const agenda = agendaDelDia(visitas, hoy).map((v) => {
    const cliente = cartera.clientes.find((c) => c.id === v.clienteId);
    const proyecto = cliente ? proyectosDe(cartera, cliente.id).find((p) => p.id === v.proyectoId) : undefined;
    return {
      ...v,
      cliente: cliente?.codigoCorto ?? '—',
      proyecto: proyecto?.nombre ?? '—',
      tipo: proyecto?.servicios.find((s) => s.id === v.servicioId)?.tipoId ?? '—',
      tecnico: PERSONAL_MOCK.find((p) => p.id === v.tecnicoTitularId)?.nombre ?? 'Sin titular',
    };
  });
  const cerrados = agenda.filter((v) => v.estadoCampo === 'EN_REVISION').length;

  return (
    <div className="dashboard-page">
      <TicketHeader
        code={new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
        title="Panel de control"
        meta={`Turno actual · ${NOMBRE_ROL[rol]}`}
        action={
          <Button variant="secondary" onClick={() => exportarAlertas(alertas, hoy)} disabled={alertas.length === 0}>
            Exportar alertas
          </Button>
        }
      />

      <div className="dashboard-page__body">
        <div className="dash-pestanas" role="tablist" aria-label="Secciones del panel de control">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`dash-tab-${p.id}`}
              aria-selected={pestana === p.id}
              aria-controls={`dash-panel-${p.id}`}
              className={pestana === p.id ? 'dash-pestana dash-pestana--activa' : 'dash-pestana'}
              onClick={() => setPestana(p.id)}
            >
              {p.etiqueta}
              {p.id === 'hoy' && alertas.length > 0 ? <span className="dash-pestana__conteo tabular">{alertas.length}</span> : null}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`dash-panel-${pestana}`} aria-labelledby={`dash-tab-${pestana}`} className="dash-panel">
          {pestana === 'hoy' ? (
            <>
              <section className="dashboard-section" aria-labelledby="alertas-heading">
                <h2 id="alertas-heading" className="dashboard-section__title">
                  Alertas activas <span className="tabular">({alertas.length})</span>
                </h2>
                {alertas.length === 0 ? (
                  <p className="dashboard-empty">Sin alertas activas: cartera al día.</p>
                ) : (
                  <AlertasResumen alertas={alertas} onAbrirDocumento={onAbrirDocumento} />
                )}
              </section>

              <section className="dashboard-section" aria-labelledby="servicios-heading">
                <h2 id="servicios-heading" className="dashboard-section__title">
                  Servicios de hoy{' '}
                  <span className="tabular">
                    ({cerrados}/{agenda.length} completados)
                  </span>
                </h2>
                {agenda.length === 0 ? (
                  <p className="dashboard-empty">No hay visitas programadas para hoy.</p>
                ) : (
                  <ul className="dashboard-servicios">
                    {agenda.map((s, i) => (
                      <li key={s.id}>
                        <div className={`dashboard-servicio ${s.estadoCampo === 'EN_REVISION' ? 'dashboard-servicio--completado' : ''}`}>
                          <span className="dashboard-servicio__hora tabular">{s.hora}</span>
                          <span className="dashboard-servicio__cliente">
                            {s.cliente} <span className="dashboard-servicio__proyecto">· {s.proyecto}</span>
                          </span>
                          <span className="dashboard-servicio__tipo">{s.tipo}</span>
                          <span className="dashboard-servicio__tecnico">{s.tecnico}</span>
                          <span className="dashboard-servicio__estado">
                            <Badge color={ESTADO_VISITA[s.estadoCampo].color}>{ESTADO_VISITA[s.estadoCampo].etiqueta}</Badge>
                          </span>
                        </div>
                        {i < agenda.length - 1 && <PerforatedDivider />}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dashboard-section" aria-labelledby="pendientes-heading">
                <h2 id="pendientes-heading" className="dashboard-section__title">
                  Pendientes de aprobación <span className="tabular">({pendientes.length})</span>
                </h2>
                {pendientes.length === 0 ? (
                  <p className="dashboard-empty">Ningún documento esperando revisión.</p>
                ) : (
                  <ul className="dashboard-servicios">
                    {pendientes.map((d, i) => (
                      <li key={d.id}>
                        <button type="button" className="dashboard-pendiente" onClick={() => onAbrirDocumento(d.id)}>
                          <span className="dashboard-pendiente__codigo">{d.codigo}</span>
                          <span className="dashboard-servicio__cliente">
                            {d.cliente} <span className="dashboard-servicio__proyecto">· {d.proyecto}</span>
                          </span>
                          <span className="dashboard-pendiente__fecha tabular">{d.fecha}</span>
                          <span className="dashboard-servicio__estado">
                            <EstadoBadge estado={d.estado} />
                          </span>
                        </button>
                        {i < pendientes.length - 1 && <PerforatedDivider />}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}

          {pestana === 'estadisticas' ? <EstadisticasPanel historial={historial} hoy={hoy} clientes={cartera.clientes} /> : null}
          {pestana === 'clientes' ? <ResumenClientes historial={historial} hoy={hoy} clientes={cartera.clientes} /> : null}
          {pestana === 'actividades' ? <ControlActividades historial={historial} /> : null}
        </div>
      </div>
    </div>
  );
}
