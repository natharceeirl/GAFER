import { expect } from 'vitest';
import type { ZodTypeAny } from 'zod';

/** Rutas de los campos que hicieron fallar la validación (vacío si el dato es válido). */
export function rutasInvalidas(esquema: ZodTypeAny, dato: unknown): string[] {
  const res = esquema.safeParse(dato);
  return res.success ? [] : res.error.issues.map((i) => i.path.join('.'));
}

/** Afirma que el dato falla exactamente por el campo indicado, y no por otro. */
export function esperarFallaEn(esquema: ZodTypeAny, dato: unknown, campo: string): void {
  expect(rutasInvalidas(esquema, dato)).toEqual([campo]);
}
