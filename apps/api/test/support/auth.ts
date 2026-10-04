/**
 * auth.ts
 * Usuarios y tokens de prueba, sin credenciales fijas del sistema.
 *
 * Los tokens se firman con el JWT_SECRET de pruebas (jwt-env.ts). Las claves de estas pruebas son
 * constantes que solo existen en la base de pruebas y no sirven para entrar a ningún otro entorno.
 *
 * Historial de versiones
 *   v1.0  2026-10-04  ihuayhuam  Creación del archivo (GAF-93).
 */
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { CargoPersonal } from '@gafer/contracts';
import { generarHashClave } from '../../src/auth/domain/clave-hash';
import { Usuario } from '../../src/auth/domain/usuario';
import { TokenService } from '../../src/auth/infrastructure/token.service';

/** Clave con la que se crean los usuarios de prueba. */
export const CLAVE_PRUEBA = 'clave-solo-para-pruebas-e2e';

export const CARGOS: readonly CargoPersonal[] = ['ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR'];

export interface OpcionesToken {
  id?: string;
  usuario?: string;
}

/** Emite un token válido para el cargo indicado, sin pasar por el login. */
export function emitirToken(cargo: CargoPersonal, opciones: OpcionesToken = {}): string {
  const usuario = new Usuario(
    opciones.id ?? randomUUID(),
    '00000000',
    'Prueba',
    cargo,
    cargo,
    '999999999',
    opciones.usuario ?? `${cargo}.PRUEBA`,
    null,
  );
  return new TokenService().generarToken(usuario);
}

/** Encabezado Authorization con un token del cargo indicado. */
export function autorizacion(cargo: CargoPersonal, opciones: OpcionesToken = {}): Record<string, string> {
  return { Authorization: `Bearer ${emitirToken(cargo, opciones)}` };
}

let hashCompartido: Promise<string> | undefined;

/** Hash de CLAVE_PRUEBA; se calcula una vez por proceso para no pagar scrypt en cada fixture. */
export function hashClavePrueba(): Promise<string> {
  hashCompartido ??= generarHashClave(CLAVE_PRUEBA);
  return hashCompartido;
}

let contadorUsuarios = 0;

export interface UsuarioPrueba {
  id: string;
  usuario: string;
  clave: string;
  cargo: CargoPersonal;
}

/** Inserta en `personal` un usuario activo con CLAVE_PRUEBA, listo para iniciar sesión. */
export async function crearUsuarioConClave(
  db: Pool,
  cargo: CargoPersonal,
  usuario?: string,
): Promise<UsuarioPrueba> {
  contadorUsuarios += 1;
  const n = String(contadorUsuarios).padStart(4, '0');
  const nombreUsuario = (usuario ?? `${cargo.slice(0, 3)}.${n}`).toUpperCase();
  const res = await db.query(
    `INSERT INTO personal (dni, nombres, apellidos, cargo, telefono, usuario, clave_hash)
     VALUES ($1, 'Usuario', 'De Prueba', $2, '958123456', $3, $4)
     RETURNING id`,
    [`9${n.padStart(7, '0')}`, cargo, nombreUsuario, await hashClavePrueba()],
  );
  return { id: res.rows[0].id as string, usuario: nombreUsuario, clave: CLAVE_PRUEBA, cargo };
}

/** Guarda CLAVE_PRUEBA como clave de un personal que ya existe (por ejemplo, creado desde Mantenimiento). */
export async function asignarClavePrueba(db: Pool, usuario: string): Promise<void> {
  const res = await db.query('UPDATE personal SET clave_hash = $1 WHERE usuario = $2', [
    await hashClavePrueba(),
    usuario.toUpperCase(),
  ]);
  if (res.rowCount !== 1) throw new Error(`Personal ${usuario} no existe en la BD de pruebas`);
}

/**
 * Encabezado Authorization de una persona que sí existe en `personal` (se crea si hace falta).
 * Úsalo cuando la operación deja rastro con clave foránea a la persona, como la bitácora de auditoría.
 */
export async function autorizacionDePersonal(
  db: Pool,
  cargo: CargoPersonal,
  usuario: string,
): Promise<Record<string, string>> {
  const nombre = usuario.toUpperCase();
  const existente = await db.query('SELECT id FROM personal WHERE usuario = $1', [nombre]);
  const id = existente.rows[0]?.id ?? (await crearUsuarioConClave(db, cargo, nombre)).id;
  return autorizacion(cargo, { id, usuario: nombre });
}
