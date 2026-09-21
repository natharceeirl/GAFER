import { useState } from 'react';
import { TicketHeader } from '../shared/ui/molecules/TicketHeader';
import { Button } from '../shared/ui/atoms/Button';
import {
  ListaServiciosDelDia,
  SERVICIOS_DEL_DIA_MOCK,
} from '../features/operaciones/components/ListaServiciosDelDia';
import { OperacionesContainer } from '../features/operaciones/containers/OperacionesContainer';
import { EstacionDetailPage } from './EstacionDetailPage';
import './TecnicoHoyPage.css';

function fechaDeHoyLegible() {
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
}

/**
 * Home del Técnico Operador: la garita del día. Cualquier técnico
 * activo puede tomar cualquier servicio — no hay "mis servicios",
 * solo "servicios de hoy" (ver PRODUCT.md).
 */
export function TecnicoHoyPage() {
  const [servicioAbierto, setServicioAbierto] = useState<string | null>(null);

  if (servicioAbierto) {
    const servicio = SERVICIOS_DEL_DIA_MOCK.find((item) => item.servicioId === servicioAbierto);
    const esMonitoreoDeRoedores = servicio?.tipoServicio === 'DRT';

    return (
      <main>
        <div className="tecnico-hoy__volver">
          <Button type="button" variant="secondary" onClick={() => setServicioAbierto(null)}>
            ← Volver a servicios de hoy
          </Button>
        </div>
        {esMonitoreoDeRoedores ? (
          <EstacionDetailPage onCerrar={() => setServicioAbierto(null)} />
        ) : (
          <OperacionesContainer servicioId={servicioAbierto} />
        )}
      </main>
    );
  }

  return (
    <main>
      <TicketHeader
        code={fechaDeHoyLegible()}
        title="Servicios de hoy"
        meta="Técnico: sesión activa · cualquier servicio del día puede tomarse"
      />
      <div className="tecnico-hoy__lista">
        <ListaServiciosDelDia servicios={SERVICIOS_DEL_DIA_MOCK} onAbrir={setServicioAbierto} />
      </div>
    </main>
  );
}
