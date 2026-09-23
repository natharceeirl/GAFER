import type { ColorAura, TipoEstacion } from '@gafer/contracts';
import type { ClienteFila } from '../../cliente-expediente/model/clientes-mock';

type ClienteMapa = Pick<ClienteFila, 'id' | 'codigoCorto'>;
import type { EstacionCritica, ServicioRegistro } from '../../estadisticas/model/estadisticas';
import type { InspeccionRegistrada, Punto } from './aura';
import { dentroDelPoligono } from './geometria';
import { estadoDelMapa, LIMITES_MAPA, siguienteAura, type EventoEstacion, type VisitaMapa } from './visitas-mapa';

export interface PlanoBase {
  id: string;
  nombre: string;
  /** Contorno del terreno, en coordenadas del lienzo. */
  puntos: Punto[];
}

export interface MapaProyecto {
  clienteId: string;
  cliente: string;
  proyecto: string;
  planos: PlanoBase[];
  visitas: VisitaMapa[];
}

interface Plantilla {
  nombre: string;
  puntos: Punto[];
  estaciones: number;
}

const RECTANGULO: Punto[] = [
  { x: 64, y: 64 },
  { x: 640, y: 64 },
  { x: 640, y: 352 },
  { x: 64, y: 352 },
];
const FORMA_L: Punto[] = [
  { x: 64, y: 64 },
  { x: 384, y: 64 },
  { x: 384, y: 192 },
  { x: 608, y: 192 },
  { x: 608, y: 352 },
  { x: 64, y: 352 },
];
const ANGOSTO: Punto[] = [
  { x: 96, y: 128 },
  { x: 576, y: 128 },
  { x: 576, y: 320 },
  { x: 96, y: 320 },
];

const PLANTILLAS: Record<string, Plantilla[]> = {
  KALLPA: [
    { nombre: 'Planta baja', puntos: RECTANGULO, estaciones: 12 },
    { nombre: 'Primer piso', puntos: FORMA_L, estaciones: 8 },
    { nombre: 'Almacén de repuestos', puntos: ANGOSTO, estaciones: 6 },
  ],
  SAMAY: [
    { nombre: 'Planta baja', puntos: FORMA_L, estaciones: 10 },
    { nombre: 'Patio de maniobras', puntos: RECTANGULO, estaciones: 6 },
  ],
  FRIGOSUR: [
    { nombre: 'Cámaras', puntos: RECTANGULO, estaciones: 10 },
    { nombre: 'Andén de carga', puntos: ANGOSTO, estaciones: 5 },
  ],
};
const PLANTILLA_GENERICA: Plantilla[] = [{ nombre: 'Planta baja', puntos: RECTANGULO, estaciones: 8 }];

function generador(semilla: number) {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function semillaDe(texto: string): number {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Reparte `n` estaciones en una grilla dentro del terreno, con un leve desorden. */
function ubicacionesIniciales(puntos: Punto[], n: number, azar: () => number): Punto[] {
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs) + 36, Math.max(...xs) - 36, Math.min(...ys) + 36, Math.max(...ys) - 36];
  const candidatos: Punto[] = [];
  for (let y = y0; y <= y1; y += 64) for (let x = x0; x <= x1; x += 72) candidatos.push({ x, y });
  const dentro = candidatos.filter((p) => dentroDelPoligono(p, puntos));
  const paso = Math.max(1, dentro.length / n);
  return Array.from({ length: n }, (_, i) => {
    const p = dentro[Math.floor(i * paso) % dentro.length];
    return { x: Math.round(p.x + (azar() - 0.5) * 20), y: Math.round(p.y + (azar() - 0.5) * 20) };
  });
}

const SEPARACION_MINIMA = 36;

/** Dentro del terreno y sin pisar otra estación del plano. */
function libre(p: Punto, terreno: Punto[], estaciones: EnCampo[], ignorar?: EnCampo): boolean {
  return (
    dentroDelPoligono(p, terreno) &&
    estaciones.every((e) => e === ignorar || Math.hypot(e.posicion.x - p.x, e.posicion.y - p.y) >= SEPARACION_MINIMA)
  );
}

const NIVEL: Record<ColorAura, number> = { SIN_COLOR: 0, VERDE: 1, AMARILLO: 2, NARANJA: 3, ROJO: 4 };
const PORCENTAJES = [25, 50, 75, 100] as const;

interface EnCampo {
  id: string;
  numero: number;
  planoId: string;
  tipo: TipoEstacion;
  posicion: Punto;
  aura: ColorAura;
  sinConsumo: number;
}

/**
 * Mapa murino de ejemplo de una sede, construido sobre sus desratizaciones
 * ejecutadas. La primera visita instala las estaciones. Para simular las
 * decisiones del técnico en campo, cada 5 visitas acerca una estación
 * inactiva hacia el foco con más actividad, y cada 7 agrega una junto a un
 * foco naranja o rojo.
 */
export function mapaDelProyecto(historial: ServicioRegistro[], cliente: ClienteMapa, proyecto: string): MapaProyecto | null {
  const servicios = historial
    .filter((s) => s.clienteId === cliente.id && s.proyecto === proyecto && s.tipo === 'DRT' && s.ejecutado)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (servicios.length === 0) return null;

  const azar = generador(semillaDe(`${cliente.codigoCorto}/${proyecto}`));
  const plantillas = (PLANTILLAS[cliente.codigoCorto] ?? PLANTILLA_GENERICA).slice(0, LIMITES_MAPA.planosPorProyecto);
  const planos: PlanoBase[] = plantillas.map((p, i) => ({
    id: `${cliente.codigoCorto}-${proyecto}-${i + 1}`,
    nombre: p.nombre,
    puntos: p.puntos,
  }));

  const campo: EnCampo[] = plantillas.flatMap((p, i) =>
    ubicacionesIniciales(p.puntos, p.estaciones, azar).map((posicion, j) => ({
      id: `${planos[i].id}-e${j + 1}`,
      numero: j + 1,
      planoId: planos[i].id,
      tipo: (j + 1) % 4 === 0 ? 'TRAMPA_MECANICA' : 'CEBO_RATICIDA',
      posicion,
      aura: 'SIN_COLOR',
      sinConsumo: 0,
    })),
  );

  // Focos de actividad por plano; se desplazan cada 8 visitas.
  const focosDe = (planoId: string, visita: number): Punto => {
    const plano = planos.find((p) => p.id === planoId)!;
    const r = generador(semillaDe(`${planoId}/${Math.floor(visita / 8)}`));
    const candidatas = ubicacionesIniciales(plano.puntos, 12, r);
    return candidatas[Math.floor(r() * candidatas.length)];
  };

  const visitas: VisitaMapa[] = servicios.map((servicio, v) => {
    const cebo = servicio.consumos[0]?.producto ?? 'Bloque parafinado';
    const eventos: EventoEstacion[] = [];

    for (const e of campo) {
      if (v === 0) {
        eventos.push({
          estacionId: e.id,
          numero: e.numero,
          planoId: e.planoId,
          tipoEstacion: e.tipo,
          posicion: e.posicion,
          instalada: true,
          reubicadaDesde: null,
          inspeccion: null,
        });
        continue;
      }
      const foco = focosDe(e.planoId, v);
      const distancia = Math.hypot(e.posicion.x - foco.x, e.posicion.y - foco.y);
      const probabilidad = 0.05 + 0.75 * Math.exp(-(distancia * distancia) / (2 * 85 * 85));
      const huboConsumo = azar() < probabilidad;
      const malas = !huboConsumo && azar() < 0.1;
      const gramos = e.tipo === 'CEBO_RATICIDA' ? 20 : 10;
      const porcentaje = PORCENTAJES[Math.floor(azar() * PORCENTAJES.length)];
      const inspeccion: InspeccionRegistrada = {
        fecha: servicio.fecha,
        tipoCebo: e.tipo === 'CEBO_RATICIDA' ? cebo : 'Atrayente alimenticio',
        cantidadGramos: gramos,
        lote: e.tipo === 'CEBO_RATICIDA' ? 'L-2451' : 'L-0930',
        vencimiento: '2027-05-01',
        huboConsumo,
        porcentajeConsumo: huboConsumo ? porcentaje : undefined,
        cantidadReposicion: huboConsumo ? (gramos * porcentaje) / 100 : undefined,
        estadoFisico: huboConsumo ? undefined : malas ? 'MALAS_CONDICIONES' : 'BUENAS_CONDICIONES',
        cantidadRepuesta: huboConsumo ? undefined : malas ? gramos : 0,
      };
      e.aura = siguienteAura(e.aura, huboConsumo);
      e.sinConsumo = huboConsumo ? 0 : e.sinConsumo + 1;
      eventos.push({
        estacionId: e.id,
        numero: e.numero,
        planoId: e.planoId,
        tipoEstacion: e.tipo,
        posicion: e.posicion,
        instalada: false,
        reubicadaDesde: null,
        inspeccion,
      });
    }

    if (v > 0 && v % 5 === 0) {
      for (const plano of planos) {
        const propias = campo.filter((e) => e.planoId === plano.id);
        const destino = [...propias].sort((a, b) => NIVEL[b.aura] - NIVEL[a.aura])[0];
        const inactiva = propias.filter((e) => e.sinConsumo >= 4 && e !== destino).sort((a, b) => b.sinConsumo - a.sinConsumo)[0];
        if (!destino || !inactiva || NIVEL[destino.aura] < NIVEL.AMARILLO) continue;
        const nueva = [0.6, 0.5, 0.4, 0.3]
          .map((f) => ({
            x: Math.round(inactiva.posicion.x + (destino.posicion.x - inactiva.posicion.x) * f),
            y: Math.round(inactiva.posicion.y + (destino.posicion.y - inactiva.posicion.y) * f),
          }))
          .find((p) => libre(p, plano.puntos, propias, inactiva));
        if (!nueva) continue;
        const evento = eventos.find((ev) => ev.estacionId === inactiva.id)!;
        evento.reubicadaDesde = inactiva.posicion;
        evento.posicion = nueva;
        inactiva.posicion = nueva;
        inactiva.sinConsumo = 0;
      }
    }

    if (v > 0 && v % 7 === 3) {
      for (const plano of planos) {
        const propias = campo.filter((e) => e.planoId === plano.id);
        const foco = propias.find((e) => NIVEL[e.aura] >= NIVEL.NARANJA);
        if (!foco || propias.length >= LIMITES_MAPA.estacionesPorPlano) continue;
        const posicion = [
          [40, 28],
          [-40, 28],
          [40, -28],
          [-40, -28],
          [0, 44],
          [0, -44],
        ]
          .map(([dx, dy]) => ({ x: foco.posicion.x + dx, y: foco.posicion.y + dy }))
          .find((p) => libre(p, plano.puntos, propias));
        if (!posicion) continue;
        const numero = Math.max(...propias.map((e) => e.numero)) + 1;
        const nueva: EnCampo = {
          id: `${plano.id}-e${numero}`,
          numero,
          planoId: plano.id,
          tipo: 'CEBO_RATICIDA',
          posicion,
          aura: 'SIN_COLOR',
          sinConsumo: 0,
        };
        campo.push(nueva);
        eventos.push({
          estacionId: nueva.id,
          numero,
          planoId: plano.id,
          tipoEstacion: 'CEBO_RATICIDA',
          posicion,
          instalada: true,
          reubicadaDesde: null,
          inspeccion: null,
        });
      }
    }

    return { id: servicio.id, fecha: servicio.fecha, tecnico: servicio.tecnico ?? '—', eventos };
  });

  return { clienteId: cliente.id, cliente: cliente.codigoCorto, proyecto, planos, visitas };
}

/** Sedes con desratización ejecutada de cada cliente, con su mapa. */
export function mapasDeLaCartera(historial: ServicioRegistro[], clientes: ClienteMapa[]): MapaProyecto[] {
  return clientes.flatMap((c) => {
    const sedes = [
      ...new Set(historial.filter((s) => s.clienteId === c.id && s.tipo === 'DRT' && s.ejecutado).map((s) => s.proyecto)),
    ].sort();
    return sedes.flatMap((p) => mapaDelProyecto(historial, c, p) ?? []);
  });
}

/** Estaciones con aura ROJO al cierre de la última visita de cada mapa (§5.3, §11). */
export function estacionesRojoDe(historial: ServicioRegistro[], clientes: ClienteMapa[]): EstacionCritica[] {
  return mapasDeLaCartera(historial, clientes).flatMap((m) =>
    estadoDelMapa(m.visitas, m.visitas.length - 1)
      .filter((e) => e.estacion.colorAura === 'ROJO')
      .map((e) => ({
        cliente: m.cliente,
        proyecto: m.proyecto,
        plano: m.planos.find((p) => p.id === e.planoId)?.nombre ?? e.planoId,
        estacion: e.estacion.numero,
        visitasConsecutivas: e.consumosSeguidos,
      })),
  );
}
