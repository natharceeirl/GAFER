import type { Personal } from '@gafer/contracts';
import { useActualizarPersonal, useCrearPersonal, usePersonal } from '../api/use-personal';
import { camposDeErrorPersonal, datosDePersonal, type DatosPersonal } from '../model/personal-mapper';
import { NuevoPersonalPage } from './NuevoPersonalPage';

interface Props {
  /** Persona que se edita; sin ella, el formulario da de alta una nueva. */
  persona?: Personal;
  onTerminar: (aviso: string) => void;
  onCancelar: () => void;
}

/** Conecta el formulario de personal con el API: guarda, reparte los errores del servidor por campo y vuelve a la lista. */
export function PersonalFormulario({ persona, onTerminar, onCancelar }: Props) {
  const lista = usePersonal();
  const crear = useCrearPersonal();
  const actualizar = useActualizarPersonal();
  const mutacion = persona ? actualizar : crear;
  const errores = mutacion.error ? camposDeErrorPersonal(mutacion.error) : null;
  const otros = (lista.data ?? []).filter((p) => p.id !== persona?.id);

  async function guardar(datos: DatosPersonal) {
    try {
      if (persona) await actualizar.mutateAsync({ id: persona.id, datos });
      else await crear.mutateAsync(datos);
    } catch {
      return; // el error queda en la mutación y se muestra en el formulario
    }
    onTerminar(persona ? 'Datos de la persona actualizados.' : 'Persona registrada.');
  }

  return (
    <NuevoPersonalPage
      inicial={persona ? datosDePersonal(persona) : undefined}
      existentes={{ dnis: otros.map((p) => p.dni), usuarios: otros.flatMap((p) => (p.usuario ? [p.usuario] : [])) }}
      enviando={mutacion.isPending}
      erroresServidor={errores?.campos}
      errorGeneral={errores?.general}
      onRegistrar={(datos) => void guardar(datos)}
      onCancelar={onCancelar}
    />
  );
}
