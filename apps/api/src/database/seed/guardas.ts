/**
 * guardas.ts
 * Comprobaciones de seguridad de db:seed:demo: opciones de la línea de comandos, rechazo en producción,
 * existencia de DATABASE_URL y confirmación explícita si la base no está en la máquina local.
 *
 * Historial de versiones
 *   v1.0  2026-10-08  ihuayhuam  Creación del archivo (GAF-94).
 */
export interface OpcionesSeed {
  limpiar: boolean;
  regenerarClaves: boolean;
  confirmarDestinoRemoto: boolean;
}

export interface Destino {
  host: string;
  puerto: string;
  base: string;
}

type Entorno = Record<string, string | undefined>;

const HOSTS_LOCALES = ['localhost', '127.0.0.1'];

export function leerOpcionesSeed(argv: string[]): OpcionesSeed {
  const opciones: OpcionesSeed = { limpiar: false, regenerarClaves: false, confirmarDestinoRemoto: false };

  for (const argumento of argv) {
    if (argumento === '--limpiar') opciones.limpiar = true;
    else if (argumento === '--regenerar-claves') opciones.regenerarClaves = true;
    else if (argumento === '--confirmar-destino-remoto') opciones.confirmarDestinoRemoto = true;
    else {
      throw new Error(
        `Argumento desconocido: ${argumento}. Admitidos: --limpiar, --regenerar-claves, --confirmar-destino-remoto`,
      );
    }
  }

  if (opciones.limpiar && opciones.regenerarClaves) {
    throw new Error('--limpiar y --regenerar-claves no se combinan: la limpieza no crea usuarios ni claves.');
  }
  return opciones;
}

export function leerDestino(urlBase: string): Destino {
  let url: URL;
  try {
    url = new URL(urlBase);
  } catch {
    throw new Error('DATABASE_URL no es una URL válida (se espera postgresql://usuario:clave@host:puerto/base).');
  }
  return {
    host: url.hostname,
    puerto: url.port || '5432',
    base: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
}

/** Rechaza producción y exige DATABASE_URL; devuelve el destino para mostrarlo antes de escribir. */
export function verificarEntorno(entorno: Entorno): Destino {
  if (entorno.NODE_ENV?.trim().toLowerCase() === 'production') {
    throw new Error(
      'db:seed:demo no se ejecuta en producción (NODE_ENV=production): carga datos de ejemplo y no debe tocar una base real.',
    );
  }
  const url = entorno.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('Falta DATABASE_URL (por ejemplo postgresql://gafer:gafer@localhost:5432/gafer): el seed no adivina la base destino.');
  }
  return leerDestino(url);
}

/** Texto para la consola: host, puerto y base, nunca el usuario ni la clave. */
export function describirDestino(destino: Destino): string {
  return `${destino.host}:${destino.puerto}/${destino.base}`;
}

export function exigirDestinoConfirmado(destino: Destino, opciones: OpcionesSeed): void {
  if (HOSTS_LOCALES.includes(destino.host) || opciones.confirmarDestinoRemoto) return;
  throw new Error(
    `El destino ${describirDestino(destino)} no es local. Si de verdad quieres escribir ahí, repite el comando con --confirmar-destino-remoto.`,
  );
}
