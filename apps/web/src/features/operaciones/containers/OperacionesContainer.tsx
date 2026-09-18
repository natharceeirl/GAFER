import { useBorradorStore } from '../model/use-borrador-store';
import { useInspeccionQuery } from '../api/use-inspeccion-query';
import { OperacionesForm } from '../components/OperacionesForm';

export interface OperacionesContainerProps {
  servicioId: string;
}

/**
 * Container: conecta DOS mecanismos de estado separados (cache de
 * servidor + store local de borrador) y solo le pasa props planas al
 * presentacional. Nunca combina ambos en un único store.
 */
export function OperacionesContainer({ servicioId }: OperacionesContainerProps) {
  const { data: inspeccionRemota, isLoading } = useInspeccionQuery(servicioId);
  const borrador = useBorradorStore((state) => state.borrador);
  const iniciarBorrador = useBorradorStore((state) => state.iniciarBorrador);
  const actualizarObservaciones = useBorradorStore((state) => state.actualizarObservaciones);

  if (isLoading) {
    return <p>Cargando inspección…</p>;
  }

  return (
    <OperacionesForm
      estadoRemoto={inspeccionRemota?.estado ?? null}
      observaciones={borrador?.observaciones ?? ''}
      onIniciar={() => iniciarBorrador(servicioId)}
      onCambiarObservaciones={actualizarObservaciones}
    />
  );
}
