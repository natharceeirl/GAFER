import type { EstacionVisitaEntrada } from '@gafer/contracts';
import { EstacionEnMapa, EventoEstacion, LIMITES_MAPA, Punto } from './mapa';

/** Datos que no cumplen las reglas del mapa (§5.1 a §5.3): responde 400. */
export class ReglaMapaError extends Error {}

/** Se superó la capacidad de planos o de estaciones (§5.1): responde 409. */
export class LimiteMapaExcedidoError extends Error {}

/** La operación choca con el estado actual del mapa (por ejemplo, reescribir el pasado): responde 409. */
export class ConflictoMapaError extends Error {}

const mismoPunto = (a: Punto, b: Punto) => a.x === b.x && a.y === b.y;

/**
 * `fecha` es la de la visita: queda como fecha de cada inspección.
 * Convierte lo que el técnico declara en una visita en los eventos que se guardan, aplicando las reglas del mapa
 * contra el estado en que quedó el plano en la visita anterior (`previo`):
 *  - hasta 100 estaciones por plano, sin ids ni números repetidos;
 *  - la visita de instalación no inspecciona (el aura se evalúa desde la siguiente) ni reubica;
 *  - una estación ya instalada se inspecciona en cada visita y conserva número y tipo;
 *  - cambiar de lugar exige marcar `reubicada`; el servidor guarda de dónde vino;
 *  - una estación que no figura se considera retirada.
 */
export function construirEventos(
  planoId: string,
  fecha: string,
  previo: readonly EstacionEnMapa[],
  entradas: readonly EstacionVisitaEntrada[],
): EventoEstacion[] {
  if (entradas.length > LIMITES_MAPA.estacionesPorPlano) {
    throw new LimiteMapaExcedidoError(`Un plano admite hasta ${LIMITES_MAPA.estacionesPorPlano} estaciones`);
  }

  if (entradas.length === 0) throw new ReglaMapaError('La visita debe registrar al menos una estación');

  const ids = new Set<string>();
  const numeros = new Set<number>();
  for (const e of entradas) {
    if (ids.has(e.estacionId)) throw new ReglaMapaError(`La estación ${e.estacionId} está repetida en la visita`);
    if (numeros.has(e.numero)) throw new ReglaMapaError(`El número ${e.numero} está repetido en el plano`);
    ids.add(e.estacionId);
    numeros.add(e.numero);
  }

  const previas = new Map(previo.map((p) => [p.estacion.id, p]));

  return entradas.map((e): EventoEstacion => {
    const anterior = previas.get(e.estacionId);

    if (e.instalada) {
      if (anterior) throw new ReglaMapaError(`La estación ${e.numero} ya está instalada en el plano`);
      if (e.inspeccion) throw new ReglaMapaError(`La estación ${e.numero} se instala en esta visita: no se inspecciona hasta la siguiente`);
      if (e.reubicada) throw new ReglaMapaError(`La estación ${e.numero} se instala en esta visita: no se puede reubicar`);
      return {
        estacionId: e.estacionId,
        numero: e.numero,
        planoId,
        tipoEstacion: e.tipoEstacion,
        posicion: e.posicion,
        instalada: true,
        reubicadaDesde: null,
        inspeccion: null,
      };
    }

    if (!anterior) throw new ReglaMapaError(`La estación ${e.numero} no está instalada en el plano: márquela como instalada`);
    if (!e.inspeccion) throw new ReglaMapaError(`La estación ${e.numero} debe registrar la inspección de la visita`);
    if (anterior.estacion.numero !== e.numero) throw new ReglaMapaError(`La estación ${e.estacionId} no puede cambiar de número`);
    if (anterior.estacion.tipoEstacion !== e.tipoEstacion) throw new ReglaMapaError(`La estación ${e.numero} no puede cambiar de tipo`);

    const seMovio = !mismoPunto(anterior.posicion, e.posicion);
    if (e.reubicada && !seMovio) throw new ReglaMapaError(`La estación ${e.numero} está marcada como reubicada pero queda en la misma posición`);
    if (seMovio && !e.reubicada) throw new ReglaMapaError(`La estación ${e.numero} cambió de posición: debe marcarse como reubicada`);

    return {
      estacionId: e.estacionId,
      numero: e.numero,
      planoId,
      tipoEstacion: e.tipoEstacion,
      posicion: e.posicion,
      instalada: false,
      reubicadaDesde: e.reubicada ? anterior.posicion : null,
      inspeccion: { ...e.inspeccion, fecha },
    };
  });
}

/** Clave para ordenar visitas de un proyecto en el tiempo: fecha, hora e id como desempate estable. */
export function claveDeOrden(fecha: string, hora: string, id: string): string {
  return `${fecha}T${hora}#${id}`;
}
