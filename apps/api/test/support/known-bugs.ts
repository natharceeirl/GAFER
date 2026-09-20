/**
 * known-bugs.ts
 * Lista de errores conocidos del sistema y cómo se marcan en las pruebas.
 *
 * Cómo funciona
 *   - Una prueba marcada con itBug('BUG-01', ...) depende de un error que todavía existe.
 *   - Mientras el error siga abierto (abierto: true), la prueba se da por buena si FALLA. Así el
 *     reporte sale en verde y el error queda documentado.
 *   - Cuando alguien arregla el error, esa prueba pasa a fallar en rojo con el mensaje
 *     "Failing test passed...". Es el aviso para cambiar abierto a false; desde entonces la
 *     prueba es normal y protege contra que el error vuelva.
 *   - Para comprobar un arreglo sin editar este archivo:
 *       Linux / Mac:  FIXED_BUGS=BUG-01 pnpm test:e2e
 *       PowerShell:   $env:FIXED_BUGS="BUG-01"; pnpm test:e2e
 *
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación del archivo.
 */
export interface DefectoConocido {
  abierto: boolean;
  titulo: string;
  responsable: string;
  donde: string;
}

export const BUGS = {
  'BUG-01': {
    abierto: false,
    titulo: 'Cerrar una inspección responde error 500 con la base real (la fecha se convierte mal).',
    responsable: 'Backend',
    donde: 'apps/api/src/operaciones/infrastructure/adapters/kysely-inspeccion.repository.ts (mapToDomain)',
  },
  'BUG-03': {
    abierto: true,
    titulo: 'La base de datos permite modificar el snapshot de una inspección cerrada.',
    responsable: 'Backend',
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

/** Igual que `it`, pero para pruebas que dependen de un error conocido. */
export function itBug(id: BugId, nombre: string, fn: Cuerpo, timeout?: number): void {
  const declarar = bugAbierto(id) ? it.failing : it;
  declarar(`[${id}] ${nombre}`, fn as jest.ProvidesCallback, timeout);
}
