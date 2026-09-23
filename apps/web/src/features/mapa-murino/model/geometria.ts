import type { Punto } from './aura';

/** Ray casting — ¿el punto cae dentro del polígono cerrado? */
export function dentroDelPoligono(punto: Punto, poligono: Punto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const pi = poligono[i];
    const pj = poligono[j];
    const cruza = pi.y > punto.y !== pj.y > punto.y && punto.x < ((pj.x - pi.x) * (punto.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}
