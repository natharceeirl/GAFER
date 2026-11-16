import { useState } from 'react';

const PREFIJO = 'gafer-barra-lateral:';

function claveDe(usuario: string): string {
  return `${PREFIJO}${usuario.toLowerCase()}`;
}

function ocultaGuardada(usuario: string): boolean {
  try {
    return localStorage.getItem(claveDe(usuario)) === 'oculta';
  } catch {
    return false;
  }
}

/**
 * Barra lateral plegable. Empieza desplegada; la elección se guarda en este
 * navegador por usuario, para que dos personas en el mismo equipo no se pisen.
 */
export function useBarraLateral(usuario: string): { oculta: boolean; alternar: () => void } {
  const [oculta, setOculta] = useState(() => ocultaGuardada(usuario));

  function alternar() {
    const siguiente = !oculta;
    setOculta(siguiente);
    try {
      if (siguiente) localStorage.setItem(claveDe(usuario), 'oculta');
      else localStorage.removeItem(claveDe(usuario));
    } catch {
      // Sin almacenamiento (modo privado): el cambio vale solo para esta sesión.
    }
  }

  return { oculta, alternar };
}
