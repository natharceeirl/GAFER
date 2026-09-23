import { createContext, useContext, useState, type ReactNode } from 'react';
import { estadoInicialCartera, type CarteraEstado } from './cartera';

interface CarteraContexto {
  cartera: CarteraEstado;
  setCartera: (actualizar: (prev: CarteraEstado) => CarteraEstado) => void;
}

const Contexto = createContext<CarteraContexto | null>(null);

/** Vive por encima del login: lo que da de alta el Administrador lo ve después el técnico en la misma demo. */
export function CarteraProvider({ children }: { children: ReactNode }) {
  const [cartera, setCartera] = useState<CarteraEstado>(estadoInicialCartera);
  return <Contexto.Provider value={{ cartera, setCartera }}>{children}</Contexto.Provider>;
}

export function useCartera(): CarteraContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useCartera debe usarse dentro de CarteraProvider');
  return ctx;
}
