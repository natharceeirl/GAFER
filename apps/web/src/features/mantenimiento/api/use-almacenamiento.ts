import { useMutation } from '@tanstack/react-query';
import type { CarpetaPdf } from '../model/validaciones';
import { subirPdf, urlDeDescarga } from './almacenamiento-api';

/** Sube un PDF y devuelve su clave; el estado de la mutación sirve para mostrar "subiendo", error y reintento. */
export function useSubirPdf() {
  return useMutation({ mutationFn: ({ archivo, carpeta }: { archivo: File; carpeta: CarpetaPdf }) => subirPdf(archivo, carpeta) });
}

/** Abre en otra pestaña el PDF de una clave, con una URL prefirmada que vence a la hora. */
export function useAbrirPdf() {
  return useMutation({
    mutationFn: async (key: string) => {
      const enlace = document.createElement('a');
      enlace.href = await urlDeDescarga(key);
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.click();
    },
  });
}
