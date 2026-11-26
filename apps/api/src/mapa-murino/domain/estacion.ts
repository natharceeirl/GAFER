import type { ColorAura, ColorIcono } from '@gafer/contracts';
import { colorIconoDe, siguienteAura } from './mapa';

export type { ColorAura, ColorIcono };

/**
 * Aggregate de dominio puro (sin I/O, sin framework): representa una
 * estación del mapa murino con sus dos capas visuales independientes
 * (sección 5 de la especificación). La regla del aura vive en `mapa.ts`
 * y se comparte con la reconstrucción del mapa por visita.
 *
 * - Ícono: solo el estado de la última inspección (no acumulativo).
 * - Aura: tendencia acumulada de las últimas inspecciones consecutivas.
 *   Regla fundamental: el aura sube o baja EXACTAMENTE un nivel por
 *   visita — nunca salta de ROJO a VERDE ni de sin color a ROJO.
 *   Se calcula desde la segunda visita: la visita de instalación no
 *   evalúa consumo, así que `registrarInspeccion` se usa desde ahí.
 */
export class Estacion {
  constructor(
    public readonly id: string,
    public readonly numero: number,
    private colorIcono: ColorIcono = 'VERDE',
    private colorAura: ColorAura = 'SIN_COLOR',
  ) {}

  registrarInspeccion(huboConsumo: boolean): void {
    this.colorIcono = colorIconoDe(huboConsumo);
    this.colorAura = siguienteAura(this.colorAura, huboConsumo);
  }

  getColorIcono(): ColorIcono {
    return this.colorIcono;
  }

  getColorAura(): ColorAura {
    return this.colorAura;
  }
}
