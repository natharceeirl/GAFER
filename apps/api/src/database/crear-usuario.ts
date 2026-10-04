/**
 * crear-usuario.ts
 * Crea o actualiza un usuario con clave en la tabla `personal` (único camino para crear el primer Administrador).
 *
 * Uso (desde la raíz del monorepo):
 *   GAFER_CLAVE='...' pnpm db:crear-usuario --usuario m.quispe --cargo ADMINISTRADOR \
 *     --dni 45892312 --nombres Maria --apellidos "Quispe Rojas" --telefono 958123456
 *
 * Cada dato se puede dar como argumento (`--dni`) o como variable de entorno (`GAFER_DNI`).
 * La clave NO se acepta por argumento: va en `GAFER_CLAVE` o se pide por consola sin mostrarla.
 *
 * Historial de versiones
 *   v1.0  2026-10-04  ihuayhuam  Creación del archivo (GAF-93).
 */
import * as readline from 'readline';
import { Writable } from 'stream';
import { Kysely } from 'kysely';
import { CrearUsuario, CrearUsuarioSchema } from '@gafer/contracts';
import { generarHashClave } from '../auth/domain/clave-hash';
import { createDatabasePool, createKyselyDatabase } from './connection';
import { GaferDatabase } from './types';

const CAMPOS = ['usuario', 'cargo', 'dni', 'nombres', 'apellidos', 'telefono'] as const;

type Entorno = Record<string, string | undefined>;

export interface ResultadoCrearUsuario {
  accion: 'creado' | 'actualizado';
  id: string;
  usuario: string;
  cargo: string;
  estado: string;
}

/** Combina argumentos `--campo valor` y variables `GAFER_CAMPO`; la clave solo sale del entorno. */
export function leerDatosUsuario(argv: string[], entorno: Entorno): Record<string, string | undefined> {
  const argumentos: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 2) {
    const bandera = argv[i];
    const nombre = bandera.replace(/^--/, '');
    if (nombre === 'clave') {
      throw new Error(
        'La clave no se acepta por argumento (quedaría en el historial y en la lista de procesos). ' +
          'Usa la variable de entorno GAFER_CLAVE o déjala vacía para ingresarla por consola.',
      );
    }
    if (!bandera.startsWith('--') || !(CAMPOS as readonly string[]).includes(nombre)) {
      throw new Error(`Argumento desconocido: ${bandera}. Admitidos: ${CAMPOS.map((c) => `--${c}`).join(', ')}`);
    }
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith('--')) {
      throw new Error(`Falta el valor de ${bandera}`);
    }
    argumentos[nombre] = valor;
  }

  const datos: Record<string, string | undefined> = {};
  for (const campo of CAMPOS) {
    datos[campo] = argumentos[campo] ?? entorno[`GAFER_${campo.toUpperCase()}`];
  }
  datos.clave = entorno.GAFER_CLAVE;
  return datos;
}

function describirErrores(error: { issues: Array<{ path: Array<string | number>; message: string }> }): string {
  return error.issues.map((i) => `${i.path.join('.') || 'datos'}: ${i.message}`).join('; ');
}

/** Valida con los esquemas de @gafer/contracts, hashea la clave y crea o actualiza la fila de `personal`. */
export async function crearOActualizarUsuario(
  db: Kysely<GaferDatabase>,
  entrada: unknown,
): Promise<ResultadoCrearUsuario> {
  const parseo = CrearUsuarioSchema.safeParse(entrada);
  if (!parseo.success) {
    throw new Error(`Datos inválidos: ${describirErrores(parseo.error)}`);
  }
  const datos: CrearUsuario = parseo.data;

  const porUsuario = await db.selectFrom('personal').selectAll().where('usuario', '=', datos.usuario).executeTakeFirst();
  const porDni = await db.selectFrom('personal').selectAll().where('dni', '=', datos.dni).executeTakeFirst();

  if (porDni && porUsuario && porDni.id !== porUsuario.id) {
    throw new Error('El DNI ya pertenece a otra persona registrada con otro usuario');
  }
  const existente = porUsuario ?? porDni;
  if (existente?.usuario && existente.usuario !== datos.usuario) {
    throw new Error(`El DNI ya pertenece a otro usuario (${existente.usuario}); no se reasigna`);
  }

  const claveHash = await generarHashClave(datos.clave);

  if (existente) {
    const actualizado = await db
      .updateTable('personal')
      .set({
        usuario: datos.usuario,
        cargo: datos.cargo,
        dni: datos.dni,
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        telefono: datos.telefono ?? existente.telefono,
        clave_hash: claveHash,
        updated_at: new Date(),
      })
      .where('id', '=', existente.id)
      .returning(['id', 'usuario', 'cargo', 'estado'])
      .executeTakeFirstOrThrow();
    return { accion: 'actualizado', id: actualizado.id, usuario: datos.usuario, cargo: actualizado.cargo, estado: actualizado.estado };
  }

  if (!datos.telefono) {
    throw new Error('El teléfono es obligatorio al crear un usuario nuevo (--telefono o GAFER_TELEFONO)');
  }

  const creado = await db
    .insertInto('personal')
    .values({
      dni: datos.dni,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      cargo: datos.cargo,
      telefono: datos.telefono,
      usuario: datos.usuario,
      clave_hash: claveHash,
    })
    .returning(['id', 'usuario', 'cargo', 'estado'])
    .executeTakeFirstOrThrow();
  return { accion: 'creado', id: creado.id, usuario: datos.usuario, cargo: creado.cargo, estado: creado.estado };
}

/** Pide un dato por consola sin mostrar lo que se escribe. */
function pedirOculto(pregunta: string): Promise<string> {
  return new Promise((resolver) => {
    let mostrar = true;
    const salida = new Writable({
      write(fragmento, codificacion, siguiente) {
        if (mostrar) process.stdout.write(fragmento, codificacion);
        siguiente();
      },
    });
    const consola = readline.createInterface({ input: process.stdin, output: salida, terminal: true });
    consola.question(pregunta, (respuesta) => {
      consola.close();
      process.stdout.write('\n');
      resolver(respuesta);
    });
    mostrar = false;
  });
}

async function obtenerClave(entorno: Entorno): Promise<string> {
  if (entorno.GAFER_CLAVE) return entorno.GAFER_CLAVE;
  if (!process.stdin.isTTY) {
    throw new Error('Falta la clave: define GAFER_CLAVE o ejecuta el comando en una consola interactiva.');
  }
  const clave = await pedirOculto('Clave (mínimo 12 caracteres): ');
  const confirmacion = await pedirOculto('Repite la clave: ');
  if (clave !== confirmacion) throw new Error('Las claves no coinciden.');
  return clave;
}

async function main(): Promise<void> {
  const datos = leerDatosUsuario(process.argv.slice(2), process.env);
  datos.clave = await obtenerClave(process.env);

  const pool = createDatabasePool();
  const db = createKyselyDatabase(pool);
  try {
    const resultado = await crearOActualizarUsuario(db, datos);
    console.log(
      `[GAFER-USUARIOS] Usuario ${resultado.usuario} (${resultado.cargo}) ${resultado.accion} correctamente.`,
    );
    if (resultado.estado !== 'ACTIVO') {
      console.warn(
        `[GAFER-USUARIOS] Atención: el usuario está ${resultado.estado}; no podrá iniciar sesión hasta activarlo en Mantenimiento.`,
      );
    }
  } finally {
    await db.destroy();
  }
}

// Ejecución directa por CLI
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(`[GAFER-USUARIOS] ${error.message}`);
      process.exit(1);
    });
}
