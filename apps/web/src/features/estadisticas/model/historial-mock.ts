import type { TipoServicio } from '@gafer/contracts';
import { CLIENTES_MOCK } from '../../cliente-expediente/model/clientes-mock';
import type { EstacionCritica, ServicioRegistro, VencimientoCertificado } from './estadisticas';

interface Contrato {
  tipo: TipoServicio;
  cadaDias: number;
}

/** Servicios contratados por cliente; el primero es el principal y su última visita es el "último servicio" de la cartera. */
const CONTRATOS: Record<string, Contrato[]> = {
  KALLPA: [{ tipo: 'DRT', cadaDias: 15 }, { tipo: 'LRA', cadaDias: 182 }],
  SAMAY: [{ tipo: 'DSF', cadaDias: 30 }, { tipo: 'DRT', cadaDias: 30 }],
  PETROPERU: [{ tipo: 'LRA', cadaDias: 91 }, { tipo: 'DSS', cadaDias: 30 }],
  MINACORP: [{ tipo: 'DSS', cadaDias: 30 }, { tipo: 'LTS', cadaDias: 91 }],
  CONSTRUYE_SAC: [{ tipo: 'LTS', cadaDias: 61 }],
  AGROSUR: [{ tipo: 'DSF', cadaDias: 30 }],
  TRANSANDES: [{ tipo: 'DSS', cadaDias: 30 }],
  CLINIVIDA: [{ tipo: 'DSF', cadaDias: 15 }, { tipo: 'LAM', cadaDias: 30 }],
  MUNIQPA: [{ tipo: 'DRT', cadaDias: 30 }],
  FRIGOSUR: [{ tipo: 'LTG', cadaDias: 30 }, { tipo: 'DRT', cadaDias: 15 }],
  VARIOS: [{ tipo: 'DSS', cadaDias: 30 }],
  PLASTIQ: [{ tipo: 'DSF', cadaDias: 30 }],
  HOTELREAL: [{ tipo: 'DSS', cadaDias: 30 }, { tipo: 'LTG', cadaDias: 61 }],
  VIALSUR: [{ tipo: 'DRT', cadaDias: 30 }],
  TEXPACIFICO: [{ tipo: 'DSF', cadaDias: 30 }],
};

/** Clientes que dejaron de recibir servicio aunque siguen programados: aparecen como incumplimiento. */
const PROGRAMADOS_SIN_EJECUTAR = new Set(['AGROSUR']);

function generador(semilla: number) {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const r = new Date(Date.UTC(a, m - 1, d + dias));
  return r.toISOString().slice(0, 10);
}

const proyectoDe = (tipo: TipoServicio) => (tipo === 'DRT' || tipo === 'LRA' ? 'CSF_SUNNY' : 'ALMACEN_02');

function consumosDe(tipo: TipoServicio, fecha: string, azar: () => number): ServicioRegistro['consumos'] {
  const cant = (min: number, max: number) => Math.round((min + azar() * (max - min)) * 10) / 10;
  switch (tipo) {
    case 'DRT':
      return azar() < 0.6
        ? [{ producto: 'Brodifacoum 0.005% bloque parafinado', cantidad: cant(0.3, 0.8), unidad: 'kg' }]
        : [{ producto: 'Bromadiolona 0.005% pellet', cantidad: cant(0.2, 0.6), unidad: 'kg' }];
    case 'DSS':
      return fecha < '2026-03-01' && azar() < 0.4
        ? [{ producto: 'Deltametrina 2.5% SC', cantidad: cant(0.5, 2), unidad: 'L' }]
        : [{ producto: 'Cipermetrina 25% EC', cantidad: cant(1, 3), unidad: 'L' }];
    case 'DSF':
      return [{ producto: 'Hipoclorito de sodio 7.5%', cantidad: cant(2, 6), unidad: 'L' }];
    case 'LRA':
      return [{ producto: 'Hipoclorito de sodio 7.5%', cantidad: cant(5, 10), unidad: 'L' }];
    case 'LAM':
      return [{ producto: 'Hipoclorito de sodio 7.5%', cantidad: cant(1, 3), unidad: 'L' }];
    default:
      return [];
  }
}

function tecnicoPara(fecha: string, azar: () => number): string {
  const activos = fecha < '2026-05-01' ? ['Marco Ipusari', 'Jorge Huamán', 'Luis Beltrán'] : ['Marco Ipusari', 'Jorge Huamán'];
  return activos[Math.floor(azar() * activos.length)];
}

/**
 * Historial de 12 meses hacia atrás desde `hoy`. Determinista (semilla fija)
 * para que los gráficos no cambien entre recargas del mockup.
 */
export function generarHistorial(hoy: string): ServicioRegistro[] {
  const azar = generador(20260923);
  const inicio = sumarDias(hoy, -365);
  const servicios: ServicioRegistro[] = [];

  for (const cliente of CLIENTES_MOCK) {
    const contratos = CONTRATOS[cliente.codigoCorto] ?? [];
    if (!cliente.ultimoServicio) continue;
    contratos.forEach((contrato, i) => {
      const ultimo = sumarDias(cliente.ultimoServicio!, -(i === 0 ? 0 : 3 + i * 4));
      for (let fecha = ultimo; fecha >= inicio; fecha = sumarDias(fecha, -contrato.cadaDias)) {
        const ejecutado = fecha === ultimo || azar() > 0.07;
        servicios.push({
          id: `${cliente.codigoCorto}-${contrato.tipo}-${fecha}`,
          fecha,
          clienteId: cliente.id,
          cliente: cliente.codigoCorto,
          proyecto: proyectoDe(contrato.tipo),
          tipo: contrato.tipo,
          tecnico: tecnicoPara(fecha, azar),
          ejecutado,
          consumos: ejecutado ? consumosDe(contrato.tipo, fecha, azar) : [],
        });
      }
      if (PROGRAMADOS_SIN_EJECUTAR.has(cliente.codigoCorto)) {
        for (let fecha = sumarDias(ultimo, contrato.cadaDias); fecha <= hoy; fecha = sumarDias(fecha, contrato.cadaDias)) {
          servicios.push({
            id: `${cliente.codigoCorto}-${contrato.tipo}-${fecha}`,
            fecha,
            clienteId: cliente.id,
            cliente: cliente.codigoCorto,
            proyecto: proyectoDe(contrato.tipo),
            tipo: contrato.tipo,
            tecnico: null,
            ejecutado: false,
            consumos: [],
          });
        }
      }
    });
  }
  return servicios;
}

/** Certificados vigentes: el vencimiento de la cartera, asociado al servicio principal de cada cliente. */
export const VENCIMIENTOS: VencimientoCertificado[] = CLIENTES_MOCK.flatMap((c) =>
  c.proximoVencimiento && c.estado === 'ACTIVO' && CONTRATOS[c.codigoCorto]
    ? [{ cliente: c.codigoCorto, fecha: c.proximoVencimiento, tipo: CONTRATOS[c.codigoCorto][0].tipo }]
    : [],
);

export const TIPOS_CONTRATADOS: TipoServicio[] = [...new Set(Object.values(CONTRATOS).flatMap((cs) => cs.map((c) => c.tipo)))].sort();

/** Estaciones con aura ROJO activa (4+ visitas consecutivas con consumo), como llegan desde los planos. */
export const ESTACIONES_ROJO: EstacionCritica[] = [
  { cliente: 'KALLPA', proyecto: 'CSF_SUNNY', plano: 'Planta baja', estacion: 12, visitasConsecutivas: 4 },
  { cliente: 'KALLPA', proyecto: 'CSF_SUNNY', plano: 'Primer piso', estacion: 1, visitasConsecutivas: 5 },
  { cliente: 'KALLPA', proyecto: 'CSF_SUNNY', plano: 'Primer piso', estacion: 2, visitasConsecutivas: 4 },
  { cliente: 'SAMAY', proyecto: 'ALMACEN_02', plano: 'Planta baja', estacion: 7, visitasConsecutivas: 4 },
  { cliente: 'FRIGOSUR', proyecto: 'ALMACEN_02', plano: 'Cámara 2', estacion: 3, visitasConsecutivas: 6 },
];
