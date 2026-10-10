/**
 * seed-demo.ts
 * Carga datos de EJEMPLO (ficticios) para la demo H1 y el entorno de QA, sobre una base ya migrada (GAF-94).
 *
 * Uso (desde la raíz del monorepo):
 *   pnpm db:seed:demo                              Carga los datos de ejemplo (idempotente) e imprime las claves nuevas una sola vez.
 *   pnpm db:seed:demo --regenerar-claves           Además, genera claves nuevas para los usuarios de ejemplo que ya existen.
 *   pnpm db:seed:demo --limpiar                    Elimina SOLO las filas del conjunto de datos de ejemplo.
 *   pnpm db:seed:demo --confirmar-destino-remoto   Imprescindible si DATABASE_URL no apunta a localhost / 127.0.0.1.
 *
 * Se niega a correr con NODE_ENV=production y sin DATABASE_URL. Las claves se generan al azar, se guardan solo como
 * hash y se muestran en la consola una vez: no se escriben en ningún archivo.
 *
 * Historial de versiones
 *   v1.0  2026-10-08  ihuayhuam  Creación del archivo (GAF-94).
 */
import { createDatabasePool, createKyselyDatabase } from '../connection';
import { formatearCredenciales } from './claves-demo';
import { describirDestino, exigirDestinoConfirmado, leerOpcionesSeed, verificarEntorno } from './guardas';
import { EntidadDemo, limpiarDatosDemo, ORDEN_SIEMBRA, ResultadoLimpieza, ResultadoSembrado, sembrarDatosDemo } from './sembrar-demo';

const ETIQUETAS: Record<EntidadDemo | 'configuracion', string> = {
  personal: 'personal',
  insumos: 'insumos',
  equipos: 'equipos',
  clientes: 'clientes',
  sedes: 'sedes',
  servicios: 'servicios',
  textos: 'textos de catálogo',
  configuracion: 'configuración',
};

const linea = (etiqueta: string, detalle: string): string => `  ${etiqueta.padEnd(20)}${detalle}`;
const yaExistian = (n: number): string => (n === 1 ? '1 ya existía' : `${n} ya existían`);

export function formatearResumenSiembra(resultado: ResultadoSembrado): string {
  const entidades = [...ORDEN_SIEMBRA, 'configuracion'] as const;
  const lineas = entidades.map((entidad) => {
    const { creados, sinCambios } = resultado.conteos[entidad];
    if (creados === 0) return linea(ETIQUETAS[entidad], `sin cambios (${yaExistian(sinCambios)})`);
    return linea(ETIQUETAS[entidad], sinCambios > 0 ? `${creados} creados, ${yaExistian(sinCambios)}` : `${creados} creados`);
  });
  const huboCambios = entidades.some((entidad) => resultado.conteos[entidad].creados > 0);
  const cierre = huboCambios ? [] : ['Resultado: sin cambios en ninguna entidad (los datos de ejemplo ya estaban cargados).'];
  return ['Resultado por entidad:', ...lineas, ...cierre].join('\n');
}

export function formatearResumenLimpieza(resultado: ResultadoLimpieza): string {
  const lineas = ORDEN_SIEMBRA.map((entidad) => linea(ETIQUETAS[entidad], `${resultado.eliminados[entidad]} eliminados`));
  const omitidos =
    resultado.omitidos.length === 0
      ? []
      : [
          '',
          `Se conservaron ${resultado.omitidos.length} fila(s) de ejemplo por tener datos asociados o haber sido modificadas:`,
          ...resultado.omitidos.map((aviso) => `  - ${aviso}`),
        ];
  return ['Filas eliminadas (solo las del conjunto de datos de ejemplo):', ...lineas, ...omitidos].join('\n');
}

async function main(): Promise<void> {
  const opciones = leerOpcionesSeed(process.argv.slice(2));
  const destino = verificarEntorno(process.env);

  console.log(`[GAFER-SEED] Datos de EJEMPLO (ficticios), no son datos reales de GAFER.`);
  console.log(`[GAFER-SEED] Destino: ${describirDestino(destino)}`);
  exigirDestinoConfirmado(destino, opciones);

  const pool = createDatabasePool();
  const db = createKyselyDatabase(pool);
  try {
    if (opciones.limpiar) {
      console.log('[GAFER-SEED] Limpiando las filas del conjunto de datos de ejemplo...');
      console.log(formatearResumenLimpieza(await limpiarDatosDemo(db)));
      console.log('La configuración del sistema (Director Técnico) no se toca: la crea la migración.');
      return;
    }

    console.log('[GAFER-SEED] Cargando datos de ejemplo (todo o nada)...');
    const resultado = await sembrarDatosDemo(db, undefined, { regenerarClaves: opciones.regenerarClaves });
    console.log(formatearResumenSiembra(resultado));
    console.log('');
    if (resultado.credenciales.length > 0) {
      console.log(formatearCredenciales(resultado.credenciales));
    } else {
      console.log('No se generaron claves: los usuarios de ejemplo ya existían y conservan la suya (usa --regenerar-claves para renovarlas).');
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
      console.error(`[GAFER-SEED] ${error.message}`);
      process.exit(1);
    });
}
