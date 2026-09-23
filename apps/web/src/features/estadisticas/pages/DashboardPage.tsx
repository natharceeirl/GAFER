import { useMemo } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { Badge } from '../../../shared/ui/atoms/Badge';
import { Button } from '../../../shared/ui/atoms/Button';
import { ServiciosPorSemanaChart } from '../components/ServiciosPorSemanaChart';
import { NOMBRE_ROL, type Rol } from '../../auth/model/roles';
import { ALERTAS_MOCK, SERVICIOS_HOY_MOCK, SERVICIOS_POR_SEMANA_MOCK, type SeveridadAlerta } from '../model/dashboard-mock';
import './dashboard-page.css';

const HOY = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

function severidadClass(severidad: SeveridadAlerta) {
  return `dashboard-alerta dashboard-alerta--${severidad}`;
}

interface DashboardPageProps {
  /** El dashboard es exclusivo de Administrador y Supervisor — spec §10.1. */
  rol: Extract<Rol, 'ADMINISTRADOR' | 'SUPERVISOR'>;
}

export function DashboardPage({ rol }: DashboardPageProps) {
  const completados = useMemo(() => SERVICIOS_HOY_MOCK.filter((s) => s.completado).length, []);

  return (
    <div className="dashboard-page">
      <TicketHeader
        code={HOY.toUpperCase()}
        title="Panel de control"
        meta={`Turno actual · ${NOMBRE_ROL[rol]}`}
        action={<Button variant="secondary">Exportar alertas</Button>}
      />

      <div className="dashboard-page__body">
        <section className="dashboard-section" aria-labelledby="alertas-heading">
          <h2 id="alertas-heading" className="dashboard-section__title">
            Alertas activas
          </h2>
          {ALERTAS_MOCK.length === 0 ? (
            <p className="dashboard-empty">Sin alertas activas — cartera al día.</p>
          ) : (
            <ul className="dashboard-alertas">
              {ALERTAS_MOCK.map((a, i) => (
                <li key={a.id}>
                  <div className={severidadClass(a.severidad)}>
                    <span className="dashboard-alerta__texto">{a.texto}</span>
                    <span className="dashboard-alerta__detalle">{a.detalle}</span>
                  </div>
                  {i < ALERTAS_MOCK.length - 1 && <PerforatedDivider />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-section" aria-labelledby="servicios-heading">
          <h2 id="servicios-heading" className="dashboard-section__title">
            Servicios de hoy <span className="tabular">({completados}/{SERVICIOS_HOY_MOCK.length} completados)</span>
          </h2>
          <ul className="dashboard-servicios">
            {SERVICIOS_HOY_MOCK.map((s, i) => (
              <li key={s.id}>
                <div className={`dashboard-servicio ${s.completado ? 'dashboard-servicio--completado' : ''}`}>
                  <span className="dashboard-servicio__hora tabular">{s.hora}</span>
                  <span className="dashboard-servicio__cliente">
                    {s.cliente} <span className="dashboard-servicio__proyecto">· {s.proyecto}</span>
                  </span>
                  <span className="dashboard-servicio__tipo">{s.tipo}</span>
                  <span className="dashboard-servicio__tecnico">{s.tecnico}</span>
                  <span className="dashboard-servicio__estado">
                    <Badge color={s.completado ? 'VERDE' : 'AMARILLO'}>
                      {s.completado ? 'Cerrado' : 'Pendiente'}
                    </Badge>
                  </span>
                </div>
                {i < SERVICIOS_HOY_MOCK.length - 1 && <PerforatedDivider />}
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-section" aria-labelledby="grafico-heading">
          <h2 id="grafico-heading" className="dashboard-section__title">
            Cumplimiento del programa
          </h2>
          <ServiciosPorSemanaChart datos={SERVICIOS_POR_SEMANA_MOCK} />
        </section>
      </div>
    </div>
  );
}
