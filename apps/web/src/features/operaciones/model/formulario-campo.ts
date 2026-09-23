import type { TipoDocumento, TipoServicio } from '@gafer/contracts';
import type { ServicioContratado } from '../../cliente-expediente/model/expediente-mock';
import type { DocumentoDetalle } from '../../documentos/model/tipos';
import type { Insumo, PersonalOperativo } from '../../mantenimiento/model/tipos';

/**
 * Tras el cierre el documento pasa directo a revisión: es la propuesta C8
 * del documento de requerimientos ("Técnico o cierre automático", §8.3).
 */
export type EstadoFormulario = 'BORRADOR' | 'ENVIADO_A_REVISION';

export interface InsumoAplicado {
  insumoId: string;
  aplicado: boolean;
  lote: string;
  vencimiento: string;
  cantidad: string;
  unidad: string;
  zonas: string;
}

export interface FotoCampo {
  id: string;
  nombre: string;
  url: string;
}

export interface EventoFormulario {
  usuario: string;
  fechaHora: string;
  accion: 'Guardado parcial' | 'Cierre de inspección' | 'Enviado a revisión';
}

export interface FormularioCampo {
  id: string;
  clienteId: string;
  clienteCodigo: string;
  clienteRazon: string;
  proyectoId: string;
  proyectoNombre: string;
  servicioId: string;
  servicioEtiqueta: string;
  tipoServicio: TipoServicio;
  requiereCertificado: boolean;
  fecha: string;
  hora: string;
  personal: string[];
  equipos: string[];
  insumos: InsumoAplicado[];
  metodos: string[];
  temperatura: string;
  humedad: string;
  viento: string;
  estadoGeneral: string;
  nivelInfestacion: string;
  hallazgos: string[];
  hallazgosDetalle: string;
  acciones: string[];
  observaciones: string[];
  observacionesLibre: string;
  recomendaciones: string[];
  fotos: FotoCampo[];
  firma: string | null;
  firmanteNombre: string;
  firmanteCargo: string;
  responsableNoDisponible: boolean;
  certificadoNumero: string;
  certificadoEmision: string;
  certificadoVencimiento: string;
  estado: EstadoFormulario;
  guardados: EventoFormulario[];
}

export const METODOS_APLICACION = ['Nebulización', 'Aspersión', 'Termonebulización', 'Cebado', 'Fumigación'];
export const ESTADOS_GENERALES = ['Bueno', 'Regular', 'Deficiente'];
export const NIVELES_INFESTACION = ['Nulo', 'Bajo', 'Moderado', 'Alto'];
export const UNIDADES = ['g', 'kg', 'ml', 'L', 'unidad', 'sobre', 'bloque'];

interface CrearFormularioArgs {
  cliente: { id: string; codigoCorto: string; razonSocial: string };
  proyecto: { id: string; nombre: string };
  servicio: ServicioContratado;
  fecha: string;
  hora: string;
  personalInicial: string[];
}

/** Abre el formulario con lo que ya se sabe del servicio (§8.2): identificación, insumos autorizados y equipos asignados. */
export function crearFormulario({ cliente, proyecto, servicio, fecha, hora, personalInicial }: CrearFormularioArgs): FormularioCampo {
  return {
    id: `${cliente.id}__${proyecto.id}__${servicio.id}__${fecha}`,
    clienteId: cliente.id,
    clienteCodigo: cliente.codigoCorto,
    clienteRazon: cliente.razonSocial,
    proyectoId: proyecto.id,
    proyectoNombre: proyecto.nombre,
    servicioId: servicio.id,
    servicioEtiqueta: servicio.tipo,
    tipoServicio: servicio.tipoId,
    requiereCertificado: servicio.requiereCertificado,
    fecha,
    hora,
    personal: personalInicial,
    equipos: [...servicio.equipos],
    insumos: servicio.insumos.map((insumoId) => ({
      insumoId,
      aplicado: true,
      lote: '',
      vencimiento: '',
      cantidad: '',
      unidad: 'g',
      zonas: '',
    })),
    metodos: [],
    temperatura: '',
    humedad: '',
    viento: '',
    estadoGeneral: '',
    nivelInfestacion: '',
    hallazgos: [],
    hallazgosDetalle: '',
    acciones: [],
    observaciones: [],
    observacionesLibre: '',
    recomendaciones: [],
    fotos: [],
    firma: null,
    firmanteNombre: '',
    firmanteCargo: '',
    responsableNoDisponible: false,
    certificadoNumero: '',
    certificadoEmision: '',
    certificadoVencimiento: '',
    estado: 'BORRADOR',
    guardados: [],
  };
}

export type BloqueCierre =
  | 'personal'
  | 'equipos'
  | 'insumos'
  | 'metodos'
  | 'condiciones'
  | 'diagnostico'
  | 'conformidad'
  | 'certificado';

function vacio(v: string) {
  return v.trim() === '';
}

function numeroEntre(v: string, min: number, max: number) {
  if (vacio(v)) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max;
}

/** Lo que debe estar completo para cerrar la inspección; el borrador se guarda sin validar (§8.2). */
export function validarCierre(f: FormularioCampo): Partial<Record<BloqueCierre, string>> {
  const e: Partial<Record<BloqueCierre, string>> = {};

  if (f.personal.length === 0) e.personal = 'Agregue al menos una persona que intervino.';
  if (f.equipos.length === 0) e.equipos = 'Marque al menos un equipo utilizado.';

  const aplicados = f.insumos.filter((i) => i.aplicado);
  if (aplicados.length === 0) e.insumos = 'Marque al menos un insumo aplicado.';
  else if (aplicados.some((i) => vacio(i.lote) || vacio(i.vencimiento) || !(Number(i.cantidad) > 0) || vacio(i.zonas)))
    e.insumos = 'Complete lote, vencimiento, cantidad y zonas de cada insumo aplicado.';

  if (f.metodos.length === 0) e.metodos = 'Seleccione el método de aplicación.';

  if (!numeroEntre(f.temperatura, -20, 60) || !numeroEntre(f.humedad, 0, 100) || !numeroEntre(f.viento, 0, 200))
    e.condiciones = 'Registre temperatura (°C), humedad entre 0 y 100 % y viento (km/h).';

  if (vacio(f.estadoGeneral) || vacio(f.nivelInfestacion)) e.diagnostico = 'Indique el estado general y el nivel de infestación.';

  if (!f.responsableNoDisponible && (!f.firma || vacio(f.firmanteNombre) || vacio(f.firmanteCargo)))
    e.conformidad = 'Falta la firma con nombre y cargo, o marcar que el responsable no estuvo disponible.';

  if (f.requiereCertificado) {
    if (vacio(f.certificadoNumero) || vacio(f.certificadoEmision) || vacio(f.certificadoVencimiento))
      e.certificado = 'Complete número, fecha de emisión y vencimiento del certificado.';
    else if (f.certificadoVencimiento <= f.certificadoEmision) e.certificado = 'El vencimiento debe ser posterior a la emisión.';
  }

  return e;
}

export function registrarGuardado(f: FormularioCampo, usuario: string, fechaHora: string): FormularioCampo {
  return { ...f, guardados: [...f.guardados, { usuario, fechaHora, accion: 'Guardado parcial' }] };
}

export function cerrarFormulario(f: FormularioCampo, usuario: string, fechaHora: string): FormularioCampo {
  if (Object.keys(validarCierre(f)).length > 0) throw new Error('El formulario no está completo para cerrarse.');
  return {
    ...f,
    estado: 'ENVIADO_A_REVISION',
    guardados: [
      ...f.guardados,
      { usuario, fechaHora, accion: 'Cierre de inspección' },
      { usuario, fechaHora, accion: 'Enviado a revisión' },
    ],
  };
}

/** Desratización genera Reporte de Inspección; el resto de servicios, Informe de Servicio (§2). */
export function tipoDocumentoDe(tipo: TipoServicio): TipoDocumento {
  return tipo === 'DRT' ? 'REPORTE' : 'INFORME';
}

function frase(partes: string[]) {
  return partes.map((p) => p.trim()).filter(Boolean).join('. ');
}

/** Documento para la bandeja de aprobación. El correlativo se asigna al aprobar (§2), por eso va "S/N". */
export function aDocumento(
  f: FormularioCampo,
  catalogos: { personal: PersonalOperativo[]; insumos: Insumo[] },
): DocumentoDetalle {
  const tipo = tipoDocumentoDe(f.tipoServicio);
  const anio = f.fecha.slice(0, 4);
  const insumosUsados = f.insumos
    .filter((i) => i.aplicado)
    .map((i) => {
      const cat = catalogos.insumos.find((c) => c.id === i.insumoId);
      return {
        producto: cat?.nombre ?? i.insumoId,
        lote: i.lote,
        cantidad: `${i.cantidad} ${i.unidad}`,
        concentracion: cat?.concentracion ?? '—',
      };
    });

  return {
    id: f.id,
    codigo: `${tipo}-${f.clienteCodigo}-S/N-${anio}`,
    cliente: f.clienteCodigo,
    proyecto: f.proyectoNombre,
    tipo,
    estado: f.estado === 'ENVIADO_A_REVISION' ? 'ENVIADO_A_REVISION' : 'BORRADOR',
    fecha: f.fecha,
    diagnostico: frase([
      `Estado general ${f.estadoGeneral.toLowerCase()}, nivel de infestación ${f.nivelInfestacion.toLowerCase()}`,
      f.hallazgos.length ? `Hallazgos: ${f.hallazgos.join(', ').toLowerCase()}` : '',
      f.hallazgosDetalle,
    ]),
    trabajosRealizados: frase([
      f.servicioEtiqueta,
      `Método: ${f.metodos.join(', ').toLowerCase()}`,
      `Condiciones: ${f.temperatura} °C, ${f.humedad} % de humedad, viento ${f.viento} km/h`,
    ]),
    insumosUsados,
    personal: f.personal
      .map((id) => catalogos.personal.find((p) => p.id === id))
      .filter((p): p is PersonalOperativo => Boolean(p))
      .map((p) => ({ nombre: p.nombre, cargo: p.cargo })),
    accionesCorrectivas: f.acciones,
    observaciones: frase([...f.observaciones, f.observacionesLibre]),
    recomendaciones: frase(f.recomendaciones),
    fotos: f.fotos.length,
    numeroCertificado: f.requiereCertificado ? f.certificadoNumero : '—',
    vencimientoCertificado: f.requiereCertificado ? f.certificadoVencimiento : '—',
    firmaCliente: f.responsableNoDisponible
      ? 'Responsable no disponible al momento del servicio'
      : `${f.firmanteNombre.trim()} — ${f.firmanteCargo.trim()}`,
  };
}

function sinTildes(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Usuario de sistema "m.ipusari" ↔ "Marco Ipusari" (§7.6, campo "Usuario del sistema"). */
export function personalDeUsuario(usuario: string, personal: PersonalOperativo[]): PersonalOperativo | undefined {
  const buscado = sinTildes(usuario.trim());
  return personal.find((p) => {
    const partes = sinTildes(p.nombre).split(/\s+/);
    return `${partes[0][0]}.${partes[partes.length - 1]}` === buscado;
  });
}
