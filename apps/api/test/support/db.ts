import { Pool } from 'pg';
import { assertTestDatabase, TEST_DATABASE_URL } from './config';

/** Deja todas las tablas vacías. Solo funciona sobre bases `*_test`. */
export async function resetDb(db: Pool): Promise<void> {
  assertTestDatabase(TEST_DATABASE_URL);
  await db.query(
    `TRUNCATE inspecciones_auditoria, inspecciones, servicios_contratados, proyectos,
              clientes, insumos, equipos, personal RESTART IDENTITY CASCADE`,
  );
}

export interface CambiosInsumo {
  nombre_comercial?: string;
  principio_activo?: string;
  registro_digesa?: string;
  concentracion?: string;
  dosis_estandar?: string;
}

/**
 * Simula que un administrador EDITA un insumo del catálogo.
 * Hoy la API no expone un PATCH para esto (BUG-05: la entidad Insumo es de solo lectura),
 * así que se edita directo en la BD. Cuando exista el endpoint, solo se cambia esta función.
 */
export async function editarInsumoEnCatalogo(db: Pool, insumoId: string, cambios: CambiosInsumo): Promise<void> {
  const columnas = Object.keys(cambios) as Array<keyof CambiosInsumo>;
  if (columnas.length === 0) return;
  const asignaciones = columnas.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const valores = columnas.map((c) => cambios[c]);
  const res = await db.query(`UPDATE insumos SET ${asignaciones}, updated_at = NOW() WHERE id = $1`, [insumoId, ...valores]);
  if (res.rowCount !== 1) throw new Error(`Insumo ${insumoId} no existe en la BD de pruebas`);
}

export async function eliminarInsumoDelCatalogo(db: Pool, insumoId: string): Promise<void> {
  const res = await db.query('DELETE FROM insumos WHERE id = $1', [insumoId]);
  if (res.rowCount !== 1) throw new Error(`Insumo ${insumoId} no existe en la BD de pruebas`);
}

/** JSONB del snapshot tal cual está guardado en la fila (para comparar byte a byte). */
export async function leerSnapshotCrudo(db: Pool, inspeccionId: string): Promise<string> {
  const res = await db.query('SELECT snapshot_catalogos::text AS s FROM inspecciones WHERE id = $1', [inspeccionId]);
  return res.rows[0].s as string;
}

export async function leerFilaInspeccion(db: Pool, inspeccionId: string): Promise<Record<string, unknown>> {
  const res = await db.query('SELECT * FROM inspecciones WHERE id = $1', [inspeccionId]);
  return res.rows[0] as Record<string, unknown>;
}

/**
 * Inserta directamente una inspección ya CERRADA con un snapshot conocido.
 * Sirve para probar la lectura del histórico sin depender del flujo de cierre.
 */
export async function sembrarInspeccionCerrada(
  db: Pool,
  args: { id: string; servicioId: string; codigo: string; snapshot: Record<string, unknown> },
): Promise<void> {
  await db.query(
    `INSERT INTO inspecciones (id, servicio_id, codigo_inspeccion, estado, version_sync, fecha_ejecucion, snapshot_catalogos)
     VALUES ($1, $2, $3, 'CERRADO', 2, '2026-09-19', $4::jsonb)`,
    [args.id, args.servicioId, args.codigo, JSON.stringify(args.snapshot)],
  );
}
