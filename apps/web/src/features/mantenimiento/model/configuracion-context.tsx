import { createContext, useContext, useState, type ReactNode } from 'react';
import type { DirectorTecnico } from '../../documentos/model/flujo-documento';

interface ConfiguracionContexto {
  /** Se carga una sola vez y se estampa en cada PDF aprobado (decisión C7). */
  director: DirectorTecnico | null;
  setDirector: (director: DirectorTecnico) => void;
}

const Contexto = createContext<ConfiguracionContexto | null>(null);

export function ConfiguracionProvider({ children }: { children: ReactNode }) {
  const [director, setDirector] = useState<DirectorTecnico | null>({ nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: null });
  return <Contexto.Provider value={{ director, setDirector }}>{children}</Contexto.Provider>;
}

export function useConfiguracion(): ConfiguracionContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useConfiguracion debe usarse dentro de ConfiguracionProvider');
  return ctx;
}
