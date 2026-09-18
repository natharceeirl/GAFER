export type ColorAura = 'SIN_COLOR' | 'VERDE' | 'AMARILLO' | 'NARANJA' | 'ROJO';
export type ColorIcono = 'VERDE' | 'ROJO';

const ORDEN_AURA: ColorAura[] = ['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO'];

/**
 * Aggregate de dominio puro (sin I/O, sin framework): representa una
 * estación del mapa murino con sus dos capas visuales independientes
 * (sección 5 de la especificación).
 *
 * - Ícono: solo el estado de la última inspección (no acumulativo).
 * - Aura: tendencia acumulada de las últimas inspecciones consecutivas.
 *   Regla fundamental: el aura sube o baja EXACTAMENTE un nivel por
 *   visita — nunca salta de ROJO a VERDE ni de sin color a ROJO.
 */
export class Estacion {
  constructor(
    public readonly id: string,
    public readonly numero: number,
    private colorIcono: ColorIcono = 'VERDE',
    private colorAura: ColorAura = 'SIN_COLOR',
  ) {}

  registrarInspeccion(huboConsumo: boolean): void {
    this.colorIcono = huboConsumo ? 'ROJO' : 'VERDE';
    this.colorAura = this.calcularSiguienteAura(this.colorAura, huboConsumo);
  }

  private calcularSiguienteAura(actual: ColorAura, huboConsumo: boolean): ColorAura {
    const indiceActual = ORDEN_AURA.indexOf(actual);
    if (huboConsumo) {
      const siguiente = Math.min(indiceActual + 1, ORDEN_AURA.length - 1);
      return ORDEN_AURA[siguiente];
    }
    const anterior = Math.max(indiceActual - 1, 0);
    return ORDEN_AURA[anterior];
  }

  getColorIcono(): ColorIcono {
    return this.colorIcono;
  }

  getColorAura(): ColorAura {
    return this.colorAura;
  }
}
