import { createContext, useContext, useState, type ReactNode } from 'react';
import { agregarVisita, type DatosVisita, type VisitaProgramada } from './programacion';

export function fechaLocal(desplazamientoDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desplazamientoDias);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function visitasIniciales(): VisitaProgramada[] {
  const hoy = fechaLocal();
  const manana = fechaLocal(1);
  return [
    { id: 'v1', fecha: hoy, hora: '08:00', clienteId: 'c1', proyectoId: 'p1', servicioId: 's-p1-drt', tecnicoTitularId: 'p2', observaciones: '', estadoCampo: 'EN_REVISION' },
    { id: 'v2', fecha: hoy, hora: '10:30', clienteId: 'c2', proyectoId: 'p2', servicioId: 's-p2-dsf', tecnicoTitularId: 'p3', observaciones: 'Coordinar ingreso con vigilancia.', estadoCampo: 'EN_CURSO' },
    { id: 'v3', fecha: hoy, hora: '15:00', clienteId: 'c1', proyectoId: 'p1', servicioId: 's-p1-lra', tecnicoTitularId: null, observaciones: '', estadoCampo: 'PENDIENTE' },
    { id: 'v4', fecha: manana, hora: '09:00', clienteId: 'c4', proyectoId: 'p2', servicioId: 's-p2-dsf', tecnicoTitularId: 'p2', observaciones: '', estadoCampo: 'PENDIENTE' },
  ];
}

interface ProgramacionContexto {
  visitas: VisitaProgramada[];
  programar: (d: DatosVisita) => void;
}

const Contexto = createContext<ProgramacionContexto | null>(null);

export function ProgramacionProvider({ children }: { children: ReactNode }) {
  const [visitas, setVisitas] = useState<VisitaProgramada[]>(visitasIniciales);
  return (
    <Contexto.Provider value={{ visitas, programar: (d) => setVisitas((prev) => agregarVisita(prev, d)) }}>{children}</Contexto.Provider>
  );
}

export function useProgramacion(): ProgramacionContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useProgramacion debe usarse dentro de ProgramacionProvider');
  return ctx;
}
