import type { TipoServicio } from '@gafer/contracts';

/** Un servicio programado del historial; los no ejecutados cuentan para el cumplimiento (§10.1). */
export interface ServicioRegistro {
  id: string;
  fecha: string;
  clienteId: string;
  cliente: string;
  proyecto: string;
  tipo: TipoServicio;
  tecnico: string | null;
  ejecutado: boolean;
  consumos: Array<{ producto: string; cantidad: number; unidad: string }>;
}

export interface EstacionCritica {
  cliente: string;
  proyecto: string;
  plano: string;
  estacion: number;
  visitasConsecutivas: number;
}

export interface VencimientoCertificado {
  cliente: string;
  fecha: string;
  tipo: TipoServicio;
}

export interface Serie {
  etiqueta: string;
  valor: number;
}

export type SeveridadAlerta = 'rojo' | 'amarillo' | 'ink';

export type CategoriaAlerta = 'vencido' | 'estacion' | 'por-vencer' | 'pendiente' | 'sin-servicio';

export interface Alerta {
  id: string;
  categoria: CategoriaAlerta;
  severidad: SeveridadAlerta;
  texto: string;
  detalle: string;
  /** Solo en alertas de documentos pendientes: permite abrir el documento. */
  documentoId?: string;
}

const CATEGORIAS: Array<{ categoria: CategoriaAlerta; titulo: string; severidad: SeveridadAlerta }> = [
  { categoria: 'vencido', titulo: 'Certificados vencidos', severidad: 'rojo' },
  { categoria: 'estacion', titulo: 'Estaciones en aura ROJO', severidad: 'rojo' },
  { categoria: 'por-vencer', titulo: 'Certificados por vencer (30 días)', severidad: 'amarillo' },
  { categoria: 'pendiente', titulo: 'Documentos pendientes +48 h', severidad: 'amarillo' },
  { categoria: 'sin-servicio', titulo: 'Clientes sin servicio 90+ días', severidad: 'ink' },
];

/** Resumen de alertas en cinco categorías fijas: ocupa lo mismo con 5 o con 500 alertas. */
export function agruparAlertas(alertas: Alerta[]) {
  return CATEGORIAS.map((c) => ({ ...c, alertas: alertas.filter((a) => a.categoria === c.categoria) }));
}

const DIA_MS = 86_400_000;

function aUtc(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS);
}

const redondear = (n: number) => Math.round(n * 100) / 100;
const mesDe = (fecha: string) => fecha.slice(0, 7);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Los últimos `n` meses (YYYY-MM), terminando en el mes de `hoy`. */
export function mesesHasta(hoy: string, n: number): string[] {
  const [a, m] = hoy.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const fecha = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1));
    return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export interface FiltroCumplimiento {
  tecnico?: string;
  clienteId?: string;
  tipo?: TipoServicio;
}

export function ejecutadosVsProgramados(servicios: ServicioRegistro[], meses: string[], f: FiltroCumplimiento) {
  return meses.map((mes) => {
    const delMes = servicios.filter(
      (s) =>
        mesDe(s.fecha) === mes &&
        (!f.tecnico || s.tecnico === f.tecnico) &&
        (!f.clienteId || s.clienteId === f.clienteId) &&
        (!f.tipo || s.tipo === f.tipo),
    );
    return { mes, programados: delMes.length, ejecutados: delMes.filter((s) => s.ejecutado).length };
  });
}

function contar(claves: string[]): Serie[] {
  const conteo = new Map<string, number>();
  for (const c of claves) conteo.set(c, (conteo.get(c) ?? 0) + 1);
  return [...conteo.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta));
}

const ejecutadosEn = (servicios: ServicioRegistro[], meses: string[]) =>
  servicios.filter((s) => s.ejecutado && meses.includes(mesDe(s.fecha)));

export function serviciosPorTipo(servicios: ServicioRegistro[], meses: string[]): Serie[] {
  return contar(ejecutadosEn(servicios, meses).map((s) => s.tipo));
}

export function serviciosPorTecnico(servicios: ServicioRegistro[], meses: string[]): Serie[] {
  return contar(ejecutadosEn(servicios, meses).flatMap((s) => (s.tecnico ? [s.tecnico] : [])));
}

export function vencimientosCertificados(vencimientos: VencimientoCertificado[], hoy: string, tipo: TipoServicio | null) {
  const conDias = vencimientos
    .filter((v) => !tipo || v.tipo === tipo)
    .map((v) => ({ ...v, dias: diasEntre(hoy, v.fecha) }))
    .sort((a, b) => a.dias - b.dias);
  return {
    vencidos: conDias.filter((v) => v.dias < 0),
    en30: conDias.filter((v) => v.dias >= 0 && v.dias <= 30),
    en60: conDias.filter((v) => v.dias > 30 && v.dias <= 60),
    en90: conDias.filter((v) => v.dias > 60 && v.dias <= 90),
  };
}

/** Consumo de UN producto por mes, apilado por tipo de servicio: sumar productos distintos mezclaría unidades. */
export function consumoMensual(servicios: ServicioRegistro[], meses: string[], producto: string, tipo: TipoServicio | null) {
  return meses.map((mes) => {
    const porTipo: Partial<Record<TipoServicio, number>> = {};
    for (const s of servicios) {
      if (!s.ejecutado || mesDe(s.fecha) !== mes || (tipo && s.tipo !== tipo)) continue;
      for (const c of s.consumos) {
        if (c.producto === producto) porTipo[s.tipo] = redondear((porTipo[s.tipo] ?? 0) + c.cantidad);
      }
    }
    return { mes, porTipo };
  });
}

export function estacionesCriticas(lista: EstacionCritica[], f: { cliente?: string; proyecto?: string }): EstacionCritica[] {
  return lista
    .filter((e) => (!f.cliente || e.cliente === f.cliente) && (!f.proyecto || e.proyecto === f.proyecto))
    .sort((a, b) => b.visitasConsecutivas - a.visitasConsecutivas || a.cliente.localeCompare(b.cliente));
}

interface ClienteBasico {
  id: string;
  codigoCorto: string;
  estado: 'ACTIVO' | 'INACTIVO';
}

function ultimoEjecutado(servicios: ServicioRegistro[]): string | null {
  return servicios.filter((s) => s.ejecutado).reduce<string | null>((max, s) => (max === null || s.fecha > max ? s.fecha : max), null);
}

export function clientesSinServicio(
  servicios: ServicioRegistro[],
  clientes: ClienteBasico[],
  hoy: string,
  tipo: TipoServicio | null,
  umbralDias = 90,
) {
  return clientes
    .filter((c) => c.estado === 'ACTIVO')
    .flatMap((c) => {
      const propios = servicios.filter((s) => s.clienteId === c.id && (!tipo || s.tipo === tipo));
      if (propios.length === 0) return [];
      const ultimo = ultimoEjecutado(propios);
      if (!ultimo) return [];
      const dias = diasEntre(ultimo, hoy);
      return dias > umbralDias ? [{ cliente: c.codigoCorto, ultimoServicio: ultimo, dias }] : [];
    })
    .sort((a, b) => b.dias - a.dias);
}

export function resumenClientes(
  servicios: ServicioRegistro[],
  clientes: Array<ClienteBasico & { razonSocial: string; proximoVencimiento: string | null }>,
  hoy: string,
) {
  return clientes
    .filter((c) => c.estado === 'ACTIVO')
    .map((c) => {
      const propios = servicios.filter((s) => s.clienteId === c.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
      const consumos = new Map<string, { cantidad: number; unidad: string }>();
      for (const s of propios) {
        const dias = diasEntre(s.fecha, hoy);
        if (!s.ejecutado || dias < 0 || dias > 30) continue;
        for (const k of s.consumos) {
          const previo = consumos.get(k.producto);
          consumos.set(k.producto, { cantidad: redondear((previo?.cantidad ?? 0) + k.cantidad), unidad: k.unidad });
        }
      }
      return {
        cliente: c.codigoCorto,
        razonSocial: c.razonSocial,
        ultimoServicio: ultimoEjecutado(propios),
        proximoVencimiento: c.proximoVencimiento,
        consumoReciente: [...consumos.entries()].map(([producto, v]) => `${producto}: ${v.cantidad} ${v.unidad}`),
      };
    });
}

export interface FiltroActividades {
  tecnico?: string;
  clienteId?: string;
  proyecto?: string;
  tipo?: TipoServicio;
  desde?: string;
  hasta?: string;
}

/** Servicios realizados, del más reciente al más antiguo (§11, control de actividades). */
export function filtrarActividades(servicios: ServicioRegistro[], f: FiltroActividades): ServicioRegistro[] {
  return servicios
    .filter(
      (s) =>
        s.ejecutado &&
        (!f.tecnico || s.tecnico === f.tecnico) &&
        (!f.clienteId || s.clienteId === f.clienteId) &&
        (!f.proyecto || s.proyecto === f.proyecto) &&
        (!f.tipo || s.tipo === f.tipo) &&
        (!f.desde || s.fecha >= f.desde) &&
        (!f.hasta || s.fecha <= f.hasta),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
}

interface EntradaAlertas {
  hoy: string;
  vencimientos: VencimientoCertificado[];
  estaciones: EstacionCritica[];
  pendientes: Array<{ id: string; codigo: string; cliente: string; proyecto: string; fecha: string }>;
  sinServicio: Array<{ cliente: string; ultimoServicio: string; dias: number }>;
}

/** Alertas de la vista por defecto (§11), de la más grave a la más leve. */
export function alertasActivas({ hoy, vencimientos, estaciones, pendientes, sinServicio }: EntradaAlertas): Alerta[] {
  const v = vencimientosCertificados(vencimientos, hoy, null);
  return [
    ...v.vencidos.map((x) => ({
      id: `venc-${x.cliente}-${x.fecha}`,
      categoria: 'vencido' as const,
      severidad: 'rojo' as const,
      texto: `Certificado vencido hace ${plural(-x.dias, 'día', 'días')}`,
      detalle: `${x.cliente} · ${x.tipo} · venció el ${x.fecha}`,
    })),
    ...estaciones.map((e) => ({
      id: `rojo-${e.cliente}-${e.plano}-${e.estacion}`,
      categoria: 'estacion' as const,
      severidad: 'rojo' as const,
      texto: `Estación ${e.estacion} en aura ROJO`,
      detalle: `${e.cliente} · ${e.proyecto} · ${e.plano} · ${e.visitasConsecutivas} visitas consecutivas con consumo`,
    })),
    ...v.en30.map((x) => ({
      id: `porvencer-${x.cliente}-${x.fecha}`,
      categoria: 'por-vencer' as const,
      severidad: 'amarillo' as const,
      texto: `Certificado vence en ${plural(x.dias, 'día', 'días')}`,
      detalle: `${x.cliente} · ${x.tipo} · vence el ${x.fecha}`,
    })),
    ...pendientes
      .map((p) => ({ ...p, horas: diasEntre(p.fecha, hoy) * 24 }))
      .filter((p) => p.horas > 48)
      .map((p) => ({
        id: `pend-${p.codigo}`,
        categoria: 'pendiente' as const,
        severidad: 'amarillo' as const,
        documentoId: p.id,
        texto: `Documento pendiente de aprobación hace ${p.horas} h`,
        detalle: `${p.cliente} · ${p.proyecto} · ${p.codigo}`,
      })),
    ...sinServicio.map((c) => ({
      id: `sin-${c.cliente}`,
      categoria: 'sin-servicio' as const,
      severidad: 'ink' as const,
      texto: `Cliente sin servicio hace ${plural(c.dias, 'día', 'días')}`,
      detalle: `${c.cliente} · último servicio el ${c.ultimoServicio} · riesgo de pérdida`,
    })),
  ];
}
