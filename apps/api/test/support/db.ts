/**
 * db.ts
 * Funciones para preparar, cambiar y leer datos directamente en la base de pruebas.
 *
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación del archivo.
 */
import { Pool } from 'pg';
import { assertTestDatabase, TEST_DATABASE_URL } from './config';

/** Vacía todas las tablas (solo en bases _test). */
export async function resetDb(db: Pool): Promise<void> {
  assertTestDatabase(TEST_DATABASE_URL);
  await db.query(
    `TRUNCATE auditoria_eventos, inspecciones_auditoria, inspecciones, servicios_contratados, proyectos,
              clientes, insumos, equipos, personal, catalogos_texto, configuracion_sistema RESTART IDENTITY CASCADE;

     INSERT INTO catalogos_texto (id, titulo, items, solo_administrador)
     VALUES 
     ('hallazgos', 'Tipos de hallazgo', '["Roedores vivos", "Excretas frescas", "Daño en empaques", "Nidos activos", "Sin evidencia"]'::jsonb, false),
     ('acciones-correctivas', 'Acciones correctivas', '["Sellado de perforación", "Reubicación de estación", "Retiro de cebo vencido", "Refuerzo de cebado"]'::jsonb, false),
     ('observaciones', 'Observaciones técnicas', '["Acceso restringido a zona", "Condiciones de humedad elevada", "Presencia de residuos orgánicos"]'::jsonb, false),
     ('recomendaciones', 'Recomendaciones al cliente', '["Retirar cartones acumulados", "Reparar tuberías con fuga", "Mantener orden en almacén"]'::jsonb, false),
     ('giros', 'Giros de negocio', '["Energía", "Alimentos", "Transporte", "Construcción", "Salud", "Educación", "Sector público"]'::jsonb, false),
     ('motivos-modificacion', 'Motivos de modificación', '["Error de digitación en campo", "Solicitud del cliente", "Corrección de dato de insumo", "Observación de auditoría"]'::jsonb, true)
     ON CONFLICT (id) DO NOTHING;

     INSERT INTO configuracion_sistema (id, director_nombre, director_cip, director_firma, resolucion_sanitaria, parametros)
     VALUES (
         'global',
         'Ing. Carlos Medina Ruiz',
         '84512',
         NULL,
         '0023-2024-DESA/MINSA',
         '{}'::jsonb
     )
     ON CONFLICT (id) DO NOTHING;`,
  );
}

export interface CambiosInsumo {
  nombre_comercial?: string;
  principio_activo?: string;
  registro_digesa?: string;
  concentracion?: string;
  dosis_estandar?: string;
}

/** Edita un insumo del catálogo. Se hace en la base porque la API aún no tiene esta opción (GAP-01). */
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

/** Copia guardada de la inspección, tal como está en la base. */
export async function leerSnapshotCrudo(db: Pool, inspeccionId: string): Promise<string> {
  const res = await db.query('SELECT snapshot_catalogos::text AS s FROM inspecciones WHERE id = $1', [inspeccionId]);
  return res.rows[0].s as string;
}

export async function leerFilaInspeccion(db: Pool, inspeccionId: string): Promise<Record<string, unknown>> {
  const res = await db.query('SELECT * FROM inspecciones WHERE id = $1', [inspeccionId]);
  return res.rows[0] as Record<string, unknown>;
}

/** Crea una inspección ya cerrada, sin pasar por el cierre normal. */
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
