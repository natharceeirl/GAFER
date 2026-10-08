import type { Insumo } from '@gafer/contracts';
import { mensajeDeError } from '../../../shared/api/errores';
import { Button } from '../../../shared/ui/atoms/Button';
import { EstadoCargando } from '../../cliente-expediente/components/EstadoConsulta';
import { useActivarInsumo, useDesactivarInsumo, useInsumos } from '../api/use-insumos';
import { useAbrirPdf } from '../api/use-almacenamiento';
import { ErrorLectura } from '../components/ErrorLectura';
import { etiquetaEstadoActivo, etiquetaPresentacion } from '../model/catalogos-etiquetas';

interface Props {
  onNuevo: () => void;
  onEditar: (insumo: Insumo) => void;
}

/** Catálogo de insumos (§7.5): consulta, alta, edición, activación y acceso a la ficha técnica y la MSDS de cada uno. */
export function InsumosSeccion({ onNuevo, onEditar }: Props) {
  const insumos = useInsumos();
  const activar = useActivarInsumo();
  const desactivar = useDesactivarInsumo();
  const abrir = useAbrirPdf();

  if (insumos.isPending) return <EstadoCargando mensaje="Cargando insumos…" />;
  if (insumos.isError) return <ErrorLectura error={insumos.error} recurso="los insumos" onReintentar={() => void insumos.refetch()} />;

  const ocupado = activar.isPending || desactivar.isPending;
  const error = activar.error ?? desactivar.error ?? abrir.error;

  return (
    <div className="mant-seccion">
      <div className="mant-barra">
        <p className="mant-barra__texto">
          La ficha técnica y la MSDS de cada insumo se anexan solas al PDF cuando el insumo se consume (decisión C14).
        </p>
        <Button type="button" variant="primary" onClick={onNuevo}>
          Nuevo insumo
        </Button>
      </div>
      {error ? (
        <p className="mant-aviso mant-aviso--error" role="alert">
          {mensajeDeError(error)}
        </p>
      ) : null}
      {insumos.data.length === 0 ? (
        <p className="clientes-page__vacio">Todavía no hay insumos registrados.</p>
      ) : (
        <table className="mant-tabla tabular">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Principio activo</th>
              <th>Presentación</th>
              <th>Conc.</th>
              <th>N° DIGESA</th>
              <th>Dosis estándar</th>
              <th title="Se adjuntan solos al PDF cuando el insumo se consume (decisión C14)">Anexos del PDF</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {insumos.data.map((i) => (
              <tr key={i.id} className={i.estado === 'INACTIVO' ? 'mant-fila--inactiva' : undefined}>
                <td>{i.nombreComercial}</td>
                <td>{i.principioActivo}</td>
                <td>{etiquetaPresentacion(i.presentacion)}</td>
                <td>{i.concentracion}</td>
                <td className="mant-tabla__mono">{i.registroDigesa}</td>
                <td>{i.dosisEstandar}</td>
                <td className="mant-tabla__anexos">
                  <button type="button" className="mant-enlace" aria-label={`Ver ficha técnica de ${i.nombreComercial}`} disabled={abrir.isPending} onClick={() => abrir.mutate(i.fichaTecnicaKey)}>
                    Ficha técnica
                  </button>
                  {' · '}
                  <button type="button" className="mant-enlace" aria-label={`Ver hoja MSDS de ${i.nombreComercial}`} disabled={abrir.isPending} onClick={() => abrir.mutate(i.hojaMsdsKey)}>
                    MSDS
                  </button>
                </td>
                <td>
                  <span className={`mant-estado mant-estado--${i.estado === 'ACTIVO' ? 'ok' : 'off'}`}>{etiquetaEstadoActivo(i.estado)}</span>
                </td>
                <td>
                  <div className="mant-acciones">
                    <button type="button" className="mant-enlace" aria-label={`Editar insumo ${i.nombreComercial}`} disabled={ocupado} onClick={() => onEditar(i)}>
                      Editar
                    </button>
                    {i.estado === 'ACTIVO' ? (
                      <button type="button" className="mant-enlace" aria-label={`Desactivar insumo ${i.nombreComercial}`} disabled={ocupado} onClick={() => desactivar.mutate(i.id)}>
                        Desactivar
                      </button>
                    ) : (
                      <button type="button" className="mant-enlace" aria-label={`Activar insumo ${i.nombreComercial}`} disabled={ocupado} onClick={() => activar.mutate(i.id)}>
                        Activar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
