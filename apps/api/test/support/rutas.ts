/**
 * rutas.ts
 * Enumera las rutas HTTP registradas en la aplicación Nest con su visibilidad y roles declarados.
 *
 * Sirve para probar que ninguna ruta queda sin proteger: toda ruta debe ser pública (@Public)
 * o declarar @Roles(...). Lee los metadatos de los controladores, así que no necesita base de datos.
 *
 * Historial de versiones
 *   v1.0  2026-10-04  ihuayhuam  Creación del archivo (GAF-93).
 */
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { CargoPersonal } from '@gafer/contracts';
import { IS_PUBLIC_KEY } from '../../src/auth/infrastructure/decorators/public.decorator';
import { ROLES_KEY } from '../../src/auth/infrastructure/decorators/roles.decorator';

export interface RutaRegistrada {
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'ALL';
  /** Ruta con el prefijo global, p. ej. /api/mantenimiento/clientes/:id */
  ruta: string;
  controlador: string;
  handler: string;
  publica: boolean;
  roles: CargoPersonal[];
}

export const PREFIJO_GLOBAL = '/api';

function unir(...partes: string[]): string {
  const limpias = partes.map((p) => p.replace(/^\/+|\/+$/g, '')).filter((p) => p.length > 0);
  return '/' + limpias.join('/');
}

function comoLista(valor: string | string[] | undefined): string[] {
  if (valor === undefined) return [''];
  return Array.isArray(valor) ? valor : [valor];
}

/** Recorre todos los controladores de la aplicación y devuelve una fila por cada ruta HTTP. */
export function enumerarRutas(modulesContainer: ModulesContainer): RutaRegistrada[] {
  const reflector = new Reflector();
  const rutas: RutaRegistrada[] = [];

  for (const modulo of modulesContainer.values()) {
    for (const wrapper of modulo.controllers.values()) {
      const clase = wrapper.metatype as (new (...args: never[]) => unknown) | null;
      if (!clase) continue;

      const rutasControlador = comoLista(Reflect.getMetadata(PATH_METADATA, clase));

      for (const nombre of Object.getOwnPropertyNames(clase.prototype)) {
        const handler = (clase.prototype as Record<string, unknown>)[nombre];
        if (typeof handler !== 'function') continue;
        const metodo = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (metodo === undefined) continue;

        const destinos = [handler, clase];
        for (const base of rutasControlador) {
          for (const sub of comoLista(Reflect.getMetadata(PATH_METADATA, handler))) {
            rutas.push({
              metodo: RequestMethod[metodo] as RutaRegistrada['metodo'],
              ruta: unir(PREFIJO_GLOBAL, base, sub),
              controlador: clase.name,
              handler: nombre,
              publica: reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, destinos) === true,
              roles: reflector.getAllAndOverride<CargoPersonal[]>(ROLES_KEY, destinos) ?? [],
            });
          }
        }
      }
    }
  }

  return rutas.sort((a, b) => `${a.ruta} ${a.metodo}`.localeCompare(`${b.ruta} ${b.metodo}`));
}
