/**
 * claves-demo.ts
 * Claves al azar para los usuarios de ejemplo y la tabla que se imprime una sola vez al terminar el seed.
 * El hash lo calcula `crearOActualizarUsuario` (db:crear-usuario) con `generarHashClave`; aquí no se repite el algoritmo.
 *
 * Historial de versiones
 *   v1.0  2026-10-08  ihuayhuam  Creación del archivo (GAF-94).
 */
import { randomBytes } from 'crypto';

/** 24 bytes al azar en base64url: 32 caracteres [A-Za-z0-9_-], sin rellenos ni símbolos que estorben al copiar. */
export function generarClaveDemo(): string {
  return randomBytes(24).toString('base64url');
}

export interface CredencialDemo {
  usuario: string;
  cargo: string;
  clave: string;
  /** Por qué se generó una clave nueva en esta corrida. */
  motivo: 'creado' | 'regenerada';
}

/** Tabla de texto plano usuario / cargo / clave; solo se escribe en la consola, nunca en un archivo. */
export function formatearCredenciales(credenciales: CredencialDemo[]): string {
  const encabezados = ['Usuario', 'Cargo', 'Clave', 'Estado'];
  const filas = credenciales.map((c) => [c.usuario, c.cargo, c.clave, c.motivo === 'creado' ? 'nueva' : 'regenerada']);
  const anchos = encabezados.map((encabezado, i) => Math.max(encabezado.length, ...filas.map((fila) => fila[i].length)));
  const linea = (celdas: string[]): string => celdas.map((celda, i) => celda.padEnd(anchos[i])).join('  ').trimEnd();

  return [
    'Credenciales de los usuarios de ejemplo (se muestran UNA sola vez: no se guardan en ningún archivo ni registro):',
    '',
    linea(encabezados),
    linea(anchos.map((ancho) => '-'.repeat(ancho))),
    ...filas.map(linea),
    '',
    'Los usuarios no distinguen mayúsculas. El TECNICO_OPERADOR solo entra desde la app móvil (cliente "mobile"); la web lo rechaza.',
  ].join('\n');
}
