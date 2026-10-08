import { createContext, useContext, useState, type ReactNode } from 'react';
import { estadoInicialCartera, type CarteraEstado } from './cartera';

interface CarteraContexto {
  cartera: CarteraEstado;
}

const Contexto = createContext<CarteraContexto | null>(null);

/** Vive por encima del login: entrega los clientes de ejemplo que aún usan programación, tablero y mapa murino. */
export function CarteraProvider({ children }: { children: ReactNode }) {
  const [cartera] = useState<CarteraEstado>(estadoInicialCartera);
  return <Contexto.Provider value={{ cartera }}>{children}</Contexto.Provider>;
}

export function useCartera(): CarteraContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useCartera debe usarse dentro de CarteraProvider');
  return ctx;
}
