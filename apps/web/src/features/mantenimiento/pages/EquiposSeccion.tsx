import type { Equipo, EstadoOperativoEquipo } from '@gafer/contracts';
import { mensajeDeError } from '../../../shared/api/errores';
import { Button } from '../../../shared/ui/atoms/Button';
import { EstadoCargando } from '../../cliente-expediente/components/EstadoConsulta';
import { useCambiarEstadoEquipo, useEquipos } from '../api/use-equipos';
import { ErrorLectura } from '../components/ErrorLectura';
import { ESTADOS_OPERATIVOS, etiquetaTipoEquipo } from '../model/catalogos-etiquetas';

interface Props {
  onNuevo: () => void;
  onEditar: (equipo: Equipo) => void;
}

const CLASE_ESTADO: Record<EstadoOperativoEquipo, string> = {
  OPERATIVO: 'ok',
  MANTENIMIENTO: 'warn',
  FUERA_SERVICIO: 'off',
};

/** Catálogo de equipos (§7.5): consulta, alta, edición y cambio del estado operativo. */
export function EquiposSeccion({ onNuevo, onEditar }: Props) {
  const equipos = useEquipos();
  const cambiarEstado = useCambiarEstadoEquipo();

  if (equipos.isPending) return <EstadoCargando mensaje="Cargando equipos…" />;
  if (equipos.isError) return <ErrorLectura error={equipos.error} recurso="los equipos" onReintentar={() => void equipos.refetch()} />;

  return (
    <div className="mant-seccion">
      <div className="mant-barra">
        <p className="mant-barra__texto">Un equipo fuera de servicio no se puede asignar a un servicio contratado.</p>
        <Button type="button" variant="primary" onClick={onNuevo}>
          Nuevo equipo
        </Button>
      </div>
      {cambiarEstado.error ? (
        <p className="mant-aviso mant-aviso--error" role="alert">
          {mensajeDeError(cambiarEstado.error)}
        </p>
      ) : null}
      {equipos.data.length === 0 ? (
        <p className="clientes-page__vacio">Todavía no hay equipos registrados.</p>
      ) : (
        <table className="mant-tabla tabular">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Código interno</th>
              <th>Tipo</th>
              <th>Marca y modelo</th>
              <th>Próximo mantenimiento</th>
              <th>Estado operativo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {equipos.data.map((e) => (
              <tr key={e.id}>
                <td>{e.nombre}</td>
                <td className="mant-tabla__mono">{e.codigoInterno}</td>
                <td>{etiquetaTipoEquipo(e.tipo)}</td>
                <td>{e.marcaModelo ?? '—'}</td>
                <td>{e.proximoMantenimiento ?? '—'}</td>
                <td>
                  <select
                    className={`mant-estado-select mant-estado--${CLASE_ESTADO[e.estadoOperativo] ?? 'off'}`}
                    aria-label={`Estado operativo de ${e.nombre}`}
                    value={e.estadoOperativo}
                    disabled={cambiarEstado.isPending}
                    onChange={(ev) => cambiarEstado.mutate({ id: e.id, estadoOperativo: ev.target.value as EstadoOperativoEquipo })}
                  >
                    {ESTADOS_OPERATIVOS.map((s) => (
                      <option key={s.codigo} value={s.codigo}>
                        {s.etiqueta}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="mant-tabla__acciones">
                  <button type="button" className="mant-enlace" aria-label={`Editar equipo ${e.nombre}`} disabled={cambiarEstado.isPending} onClick={() => onEditar(e)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
