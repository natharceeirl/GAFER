import { OperacionesContainer } from '../features/operaciones/containers/OperacionesContainer';

export function OperacionesPage() {
  return (
    <main>
      <h1>GAFER — Operaciones</h1>
      <OperacionesContainer servicioId="servicio-demo" />
    </main>
  );
}
