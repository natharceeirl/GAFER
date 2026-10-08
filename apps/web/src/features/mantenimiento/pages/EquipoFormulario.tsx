import type { Equipo } from '@gafer/contracts';
import { useActualizarEquipo, useCrearEquipo } from '../api/use-equipos';
import { camposDeErrorEquipo, datosDeEquipo, type DatosEquipo } from '../model/equipo-mapper';
import { NuevoEquipoPage } from './NuevoEquipoPage';

interface Props {
  /** Equipo que se edita; sin él, el formulario da de alta uno nuevo. */
  equipo?: Equipo;
  onTerminar: (aviso: string) => void;
  onCancelar: () => void;
}

/** Conecta el formulario de equipo con el API: guarda, reparte los errores del servidor por campo y vuelve a la lista. */
export function EquipoFormulario({ equipo, onTerminar, onCancelar }: Props) {
  const crear = useCrearEquipo();
  const actualizar = useActualizarEquipo();
  const mutacion = equipo ? actualizar : crear;
  const errores = mutacion.error ? camposDeErrorEquipo(mutacion.error) : null;

  async function guardar(datos: DatosEquipo) {
    try {
      if (equipo) await actualizar.mutateAsync({ id: equipo.id, datos });
      else await crear.mutateAsync(datos);
    } catch {
      return; // el error queda en la mutación y se muestra en el formulario
    }
    onTerminar(equipo ? 'Equipo actualizado.' : 'Equipo registrado.');
  }

  return (
    <NuevoEquipoPage
      inicial={equipo ? datosDeEquipo(equipo) : undefined}
      enviando={mutacion.isPending}
      erroresServidor={errores?.campos}
      errorGeneral={errores?.general}
      onRegistrar={(datos) => void guardar(datos)}
      onCancelar={onCancelar}
    />
  );
}
