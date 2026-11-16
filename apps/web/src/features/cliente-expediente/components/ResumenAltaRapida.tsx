import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { Button } from '../../../shared/ui/atoms/Button';
import { Badge } from '../../../shared/ui/atoms/Badge';
import type { ClienteFila } from '../model/clientes-mock';
import type { ProyectoExpediente } from '../model/proyecto-mapper';
import { colorEstadoTrabajo, etiquetaEstadoTrabajo, etiquetaFrecuencia, etiquetaTipoServicio } from '../model/catalogos-servicio';
import './resumen-alta-rapida.css';

interface Props {
  cliente: ClienteFila;
  sede: ProyectoExpediente;
  onAgregarServicio: () => void;
  onVerExpediente: () => void;
  /** Sin este acceso (fuera del armazón de la aplicación) no se ofrece programar la visita. */
  onProgramarVisita?: () => void;
}

/** Pantalla final del alta rápida (GAF-99): lo que quedó registrado y los siguientes pasos habituales. */
export function ResumenAltaRapida({ cliente, sede, onAgregarServicio, onVerExpediente, onProgramarVisita }: Props) {
  return (
    <div className="alta-resumen-page">
      <TicketHeader code={`${cliente.codigoCorto} · ${sede.nombre}`} title="Alta completada" meta="Alta rápida · cliente, sede y servicio registrados" />
      <section className="alta-resumen" aria-labelledby="alta-resumen-titulo">
        <h2 id="alta-resumen-titulo" className="alta-resumen__titulo">
          Resumen del alta
        </h2>
        <dl className="alta-resumen__datos">
          <dt>Cliente</dt>
          <dd>{cliente.razonSocial}</dd>
          <dt>Sede</dt>
          <dd>{sede.nombre}</dd>
          <dt>{sede.servicios.length === 1 ? 'Servicio' : 'Servicios'}</dt>
          <dd>
            <ul className="alta-resumen__servicios">
              {sede.servicios.map((s) => (
                <li key={s.id}>
                  <Badge color={colorEstadoTrabajo(s.estadoTrabajo)}>{etiquetaEstadoTrabajo(s.estadoTrabajo)}</Badge>{' '}
                  {etiquetaTipoServicio(s.tipoServicio)} · {etiquetaFrecuencia(s.frecuencia)}
                </li>
              ))}
            </ul>
          </dd>
        </dl>
        <div className="alta-resumen__acciones">
          <Button type="button" onClick={onAgregarServicio}>
            Agregar otro servicio
          </Button>
          <Button type="button" variant="secondary" onClick={onVerExpediente}>
            Ver expediente
          </Button>
          {onProgramarVisita ? (
            <Button type="button" variant="secondary" onClick={onProgramarVisita}>
              Programar visita
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
