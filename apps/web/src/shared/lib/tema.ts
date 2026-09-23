import { useEffect, useState } from 'react';

export type Tema = 'claro' | 'oscuro';

const CLAVE = 'gafer-tema';
const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

export function temaEfectivo(elegido: Tema | null, sistema: Tema): Tema {
  return elegido ?? sistema;
}

export function opuesto(tema: Tema): Tema {
  return tema === 'oscuro' ? 'claro' : 'oscuro';
}

export function atributoTema(tema: Tema): 'light' | 'dark' {
  return tema === 'oscuro' ? 'dark' : 'light';
}

function temaGuardado(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'claro' || valor === 'oscuro' ? valor : null;
  } catch {
    return null;
  }
}

function temaDelSistema(): Tema {
  return window.matchMedia(CONSULTA_OSCURO).matches ? 'oscuro' : 'claro';
}

/** Aplica el tema guardado antes del primer render, para que no parpadee el tema del sistema. */
export function aplicarTemaGuardado() {
  const guardado = temaGuardado();
  if (guardado) document.documentElement.dataset.theme = atributoTema(guardado);
}

/**
 * Tema de la interfaz. Sin elección manual sigue al sistema operativo;
 * al usar el botón, la elección se guarda en este navegador y gana.
 */
export function useTema(): { tema: Tema; alternar: () => void } {
  const [elegido, setElegido] = useState<Tema | null>(temaGuardado);
  const [sistema, setSistema] = useState<Tema>(temaDelSistema);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_OSCURO);
    const alCambiar = () => setSistema(consulta.matches ? 'oscuro' : 'claro');
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  useEffect(() => {
    if (elegido) document.documentElement.dataset.theme = atributoTema(elegido);
  }, [elegido]);

  const tema = temaEfectivo(elegido, sistema);

  function alternar() {
    const siguiente = opuesto(tema);
    setElegido(siguiente);
    try {
      localStorage.setItem(CLAVE, siguiente);
    } catch {
      // Sin almacenamiento (modo privado): el cambio vale solo para esta sesión.
    }
  }

  return { tema, alternar };
}
