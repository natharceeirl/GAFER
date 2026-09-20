/**
 * REGISTRO DE DEFECTOS CONOCIDOS (fuente única para el informe de calidad).
 *
 * Cada defecto tiene un id. Los tests que dependen de él se declaran con `itBug('BUG-xx', ...)`:
 *   - Mientras `abierto: true`  -> el test se ejecuta con `it.failing`: pasa (verde) SOLO si el bug
 *     sigue ocurriendo. Así la CI no se rompe, pero el defecto queda documentado y reproducible.
 *   - Cuando el responsable lo arregla, el test se pone ROJO con el mensaje
 *     "Failing test passed even though it was supposed to fail": esa es la alarma para poner
 *     `abierto: false` (un cambio de una línea) y que el test vuelva a ser una prueba normal.
 *
 * Para verificar un fix sin editar este archivo:  FIXED_BUGS=BUG-01,BUG-03 pnpm --filter @gafer/api test:e2e
 */
export interface DefectoConocido {
  abierto: boolean;
  titulo: string;
  responsable: string;
  donde: string;
}

export const BUGS = {
  'BUG-01': {
    abierto: true,
    titulo:
      'POST /operaciones/inspecciones/:id/cerrar responde 500 con Postgres real: fecha_ejecucion se mapea con String(Date) y Postgres rechaza ese texto (además GET devuelve la fecha con formato "Sun Sep 20 2026 ...").',
    responsable: 'Cristian',
    donde: 'apps/api/src/operaciones/infrastructure/adapters/kysely-inspeccion.repository.ts (mapToDomain)',
  },
  'BUG-03': {
    abierto: true,
    titulo:
      'La base de datos acepta UPDATE directo de snapshot_catalogos sobre una inspección CERRADA (no hay trigger ni restricción). La inmutabilidad depende solo del código de la app.',
    responsable: 'Cristian',
    donde: 'infra/migrations/001_initial_schema.up.sql',
  },
} satisfies Record<string, DefectoConocido>;

export type BugId = keyof typeof BUGS;

const corregidosPorEntorno = new Set(
  (process.env.FIXED_BUGS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export function bugAbierto(id: BugId): boolean {
  return BUGS[id].abierto && !corregidosPorEntorno.has(id);
}

type Cuerpo = () => Promise<unknown> | unknown;

/** Igual que `it`, pero marcado con el defecto conocido del que depende. */
export function itBug(id: BugId, nombre: string, fn: Cuerpo, timeout?: number): void {
  const declarar = bugAbierto(id) ? it.failing : it;
  declarar(`[${id}] ${nombre}`, fn as jest.ProvidesCallback, timeout);
}
