import { Badge } from '../../../shared/ui/atoms/Badge';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import './ListaServiciosDelDia.css';

export interface ServicioDelDia {
  servicioId: string;
  clienteCodigo: string;
  proyecto: string;
  tipoServicio: string;
  hora: string;
  sinSincronizar?: boolean;
}

/** Datos ilustrativos — en producción vienen de la programación de servicios (Fase 4). */
export const SERVICIOS_DEL_DIA_MOCK: ServicioDelDia[] = [
  { servicioId: 'srv-kallpa-drt', clienteCodigo: 'KALLPA', proyecto: 'CSF_SUNNY', tipoServicio: 'DRT', hora: '08:00' },
  { servicioId: 'srv-samay-dsf', clienteCodigo: 'SAMAY', proyecto: 'PLANTA_NORTE', tipoServicio: 'DSF', hora: '09:30', sinSincronizar: true },
  { servicioId: 'srv-petroperu-lra', clienteCodigo: 'PETROPERU', proyecto: 'ALMACEN_CENTRAL', tipoServicio: 'LRA', hora: '11:00' },
  { servicioId: 'srv-kallpa-dss', clienteCodigo: 'KALLPA', proyecto: 'CSF_SUNNY', tipoServicio: 'DSS', hora: '13:15' },
  { servicioId: 'srv-samay-ltg', clienteCodigo: 'SAMAY', proyecto: 'PLANTA_NORTE', tipoServicio: 'LTG', hora: '15:00', sinSincronizar: true },
  { servicioId: 'srv-petroperu-lam', clienteCodigo: 'PETROPERU', proyecto: 'ALMACEN_CENTRAL', tipoServicio: 'LAM', hora: '16:30' },
];

interface ListaServiciosDelDiaProps {
  servicios: ServicioDelDia[];
  onAbrir: (servicioId: string) => void;
}

export function ListaServiciosDelDia({ servicios, onAbrir }: ListaServiciosDelDiaProps) {
  if (servicios.length === 0) {
    return <p className="lista-servicios__vacio">Sin servicios programados para hoy.</p>;
  }

  return (
    <div className="lista-servicios">
      {servicios.map((servicio, indice) => (
        <div key={servicio.servicioId}>
          <button type="button" className="lista-servicios__fila" onClick={() => onAbrir(servicio.servicioId)}>
            <span className="lista-servicios__hora tabular">{servicio.hora}</span>
            <span className="lista-servicios__info">
              <strong>{servicio.clienteCodigo}</strong> · {servicio.proyecto}
            </span>
            <span className="lista-servicios__tipo">{servicio.tipoServicio}</span>
            {servicio.sinSincronizar ? <Badge color="AMARILLO">SIN SINCRONIZAR</Badge> : null}
          </button>
          {indice < servicios.length - 1 ? <PerforatedDivider /> : null}
        </div>
      ))}
    </div>
  );
}
