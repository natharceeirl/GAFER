import type { Insumo } from '@gafer/contracts';
import { useActualizarInsumo, useCrearInsumo } from '../api/use-insumos';
import { camposDeErrorInsumo, datosDeInsumo, type DatosInsumo } from '../model/insumo-mapper';
import { NuevoInsumoPage } from './NuevoInsumoPage';

interface Props {
  /** Insumo que se edita; sin él, el formulario da de alta uno nuevo. */
  insumo?: Insumo;
  onTerminar: (aviso: string) => void;
  onCancelar: () => void;
}

/** Conecta el formulario de insumo con el API: guarda, reparte los errores del servidor por campo y vuelve a la lista. */
export function InsumoFormulario({ insumo, onTerminar, onCancelar }: Props) {
  const crear = useCrearInsumo();
  const actualizar = useActualizarInsumo();
  const mutacion = insumo ? actualizar : crear;
  const errores = mutacion.error ? camposDeErrorInsumo(mutacion.error) : null;

  async function guardar(datos: DatosInsumo) {
    try {
      if (insumo) await actualizar.mutateAsync({ id: insumo.id, datos });
      else await crear.mutateAsync(datos);
    } catch {
      return; // el error queda en la mutación y se muestra en el formulario
    }
    onTerminar(insumo ? 'Insumo actualizado.' : 'Insumo registrado.');
  }

  return (
    <NuevoInsumoPage
      inicial={insumo ? datosDeInsumo(insumo) : undefined}
      enviando={mutacion.isPending}
      erroresServidor={errores?.campos}
      errorGeneral={errores?.general}
      onRegistrar={(datos) => void guardar(datos)}
      onCancelar={onCancelar}
    />
  );
}
