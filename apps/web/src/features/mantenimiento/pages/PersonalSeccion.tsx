import type { Personal } from '@gafer/contracts';
import { mensajeDeError } from '../../../shared/api/errores';
import { Button } from '../../../shared/ui/atoms/Button';
import { EstadoCargando } from '../../cliente-expediente/components/EstadoConsulta';
import { useActivarPersonal, useDesactivarPersonal, usePersonal } from '../api/use-personal';
import { ErrorLectura } from '../components/ErrorLectura';
import { etiquetaCargo, etiquetaEstadoActivo } from '../model/catalogos-etiquetas';
import { nombreCompleto } from '../model/personal-mapper';

interface Props {
  onNuevo: () => void;
  onEditar: (persona: Personal) => void;
}

/** Personal técnico y de supervisión (§7.6): consulta, alta, edición y activación. Solo el Administrador accede. */
export function PersonalSeccion({ onNuevo, onEditar }: Props) {
  const personal = usePersonal();
  const activar = useActivarPersonal();
  const desactivar = useDesactivarPersonal();

  if (personal.isPending) return <EstadoCargando mensaje="Cargando personal…" />;
  if (personal.isError) return <ErrorLectura error={personal.error} recurso="el personal" onReintentar={() => void personal.refetch()} />;

  const ocupado = activar.isPending || desactivar.isPending;
  const error = activar.error ?? desactivar.error;

  return (
    <div className="mant-seccion">
      <div className="mant-barra">
        <p className="mant-barra__texto">La clave de acceso la asigna el administrador del sistema; no se define desde esta pantalla.</p>
        <Button type="button" variant="primary" onClick={onNuevo}>
          Nueva persona
        </Button>
      </div>
      {error ? (
        <p className="mant-aviso mant-aviso--error" role="alert">
          {mensajeDeError(error)}
        </p>
      ) : null}
      {personal.data.length === 0 ? (
        <p className="clientes-page__vacio">Todavía no hay personal registrado.</p>
      ) : (
        <table className="mant-tabla tabular">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Cargo</th>
              <th>Usuario</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {personal.data.map((p) => {
              const nombre = nombreCompleto(p);
              return (
                <tr key={p.id} className={p.estado === 'INACTIVO' ? 'mant-fila--inactiva' : undefined}>
                  <td>{nombre}</td>
                  <td className="mant-tabla__mono">{p.dni}</td>
                  <td>{etiquetaCargo(p.cargo)}</td>
                  <td className="mant-tabla__mono">{p.usuario ?? '—'}</td>
                  <td>{p.telefono}</td>
                  <td>
                    <span className={`mant-estado mant-estado--${p.estado === 'ACTIVO' ? 'ok' : 'off'}`}>{etiquetaEstadoActivo(p.estado)}</span>
                  </td>
                  <td>
                    <div className="mant-acciones">
                      <button type="button" className="mant-enlace" aria-label={`Editar a ${nombre}`} disabled={ocupado} onClick={() => onEditar(p)}>
                        Editar
                      </button>
                      {p.estado === 'ACTIVO' ? (
                        <button type="button" className="mant-enlace" aria-label={`Desactivar a ${nombre}`} disabled={ocupado} onClick={() => desactivar.mutate(p.id)}>
                          Desactivar
                        </button>
                      ) : (
                        <button type="button" className="mant-enlace" aria-label={`Activar a ${nombre}`} disabled={ocupado} onClick={() => activar.mutate(p.id)}>
                          Activar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
