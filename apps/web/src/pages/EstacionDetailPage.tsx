import { useState } from 'react';
import { EstacionDetailSheet } from '../features/mapa-murino/components/EstacionDetailSheet';
import { ESTACION_MOCK, HISTORIAL_MOCK, TIPOS_CEBO_MOCK } from '../features/mapa-murino/model/mock-data';
import { crearVisitaVacia } from '../features/mapa-murino/model/tipos';

interface EstacionDetailPageProps {
  onCerrar: () => void;
}

export function EstacionDetailPage({ onCerrar }: EstacionDetailPageProps) {
  const [visitaActual, setVisitaActual] = useState(crearVisitaVacia());
  const [guardada, setGuardada] = useState(false);

  return (
    <main>
      <EstacionDetailSheet
        estacion={ESTACION_MOCK}
        historial={HISTORIAL_MOCK}
        tiposCebo={TIPOS_CEBO_MOCK}
        visitaActual={visitaActual}
        onCambiarVisita={setVisitaActual}
        onGuardarInspeccion={() => setGuardada(true)}
        onCerrar={onCerrar}
      />
      {guardada ? <p className="cargando">Inspección de estación guardada localmente.</p> : null}
    </main>
  );
}
