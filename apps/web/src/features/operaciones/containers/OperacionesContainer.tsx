import { useEffect, useState } from 'react';
import { useBorradorStore } from '../model/use-borrador-store';
import { useInspeccionQuery } from '../api/use-inspeccion-query';
import { OperacionesForm } from '../components/OperacionesForm';
import type { InspeccionBorrador } from '../model/tipos';

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
  const actualizarBloque = useBorradorStore((state) => state.actualizarBloque);
  const marcarComoPendienteDeSincronizar = useBorradorStore(
    (state) => state.marcarComoPendienteDeSincronizar,
  );
  const [cerradaLocalmente, setCerradaLocalmente] = useState(false);

  useEffect(() => {
    if (!borrador || borrador.servicioId !== servicioId) {
      iniciarBorrador(servicioId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioId]);

  if (isLoading || !borrador || borrador.servicioId !== servicioId) {
    return <p className="cargando">Cargando inspección…</p>;
  }

  function actualizarBloqueGenerico<K extends keyof InspeccionBorrador>(bloque: K, valor: InspeccionBorrador[K]) {
    actualizarBloque(bloque, valor);
  }

  return (
    <OperacionesForm
      estadoRemoto={cerradaLocalmente ? 'CERRADO' : inspeccionRemota?.estado ?? 'BORRADOR'}
      borrador={borrador}
      onActualizarBloque={actualizarBloqueGenerico}
      onGuardarBorrador={marcarComoPendienteDeSincronizar}
      onCerrarInspeccion={() => {
        setCerradaLocalmente(true);
        marcarComoPendienteDeSincronizar();
      }}
    />
  );
}
