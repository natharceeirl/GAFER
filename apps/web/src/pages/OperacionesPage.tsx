import { OperacionesContainer } from '../features/operaciones/containers/OperacionesContainer';

const DEFAULT_SERVICIO_ID = '00000000-0000-0000-0000-000000000001';

export function OperacionesPage() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const servicioId = params?.get('servicioId') || DEFAULT_SERVICIO_ID;

  return (
    <main>
      <h1>GAFER — Operaciones</h1>
      <OperacionesContainer servicioId={servicioId} />
    </main>
  );
}
