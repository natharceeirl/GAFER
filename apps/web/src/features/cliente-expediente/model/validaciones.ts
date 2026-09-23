import type { EstadoActivoInactivo, TipoServicio } from '@gafer/contracts';

export type Errores<K extends string> = Partial<Record<K, string>>;

/** Código reservado para personas naturales, que se registran bajo el cliente VARIOS (§7.1). */
export const RUC_VARIOS = '12345678910';

const RE_RUC = /^\d{11}$/;
const RE_CODIGO = /^[A-Z0-9]{4,10}$/;
const RE_NOMBRE_SEDE = /^[A-Z0-9_]{4,20}$/;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TELEFONO = /^[0-9 +()-]+$/;

const OBLIGATORIO = 'Campo obligatorio.';

function vacio(v: string) {
  return v.trim() === '';
}

function telefonoValido(v: string) {
  return RE_TELEFONO.test(v) && v.replace(/\D/g, '').length >= 6;
}

export function normalizarCodigo(v: string): string {
  return v.replace(/\s+/g, '').toUpperCase();
}

export interface DatosCliente {
  razonSocial: string;
  ruc: string;
  codigoCorto: string;
  direccionFiscal: string;
  giro: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoTelefono: string;
  contactoCorreo: string;
  estado: EstadoActivoInactivo;
}

export function validarCliente(d: DatosCliente, existentes: { codigos: string[]; rucs: string[] }): Errores<keyof DatosCliente> {
  const e: Errores<keyof DatosCliente> = {};

  if (vacio(d.razonSocial)) e.razonSocial = OBLIGATORIO;

  if (vacio(d.ruc)) e.ruc = OBLIGATORIO;
  else if (d.ruc === RUC_VARIOS) e.ruc = 'Ese código es de personas naturales: regístrelas como sede del cliente VARIOS.';
  else if (!RE_RUC.test(d.ruc)) e.ruc = 'El RUC tiene 11 dígitos, sin letras ni espacios.';
  else if (existentes.rucs.includes(d.ruc)) e.ruc = 'Ya hay un cliente registrado con ese RUC.';

  if (vacio(d.codigoCorto)) e.codigoCorto = OBLIGATORIO;
  else if (!RE_CODIGO.test(d.codigoCorto)) e.codigoCorto = 'De 4 a 10 letras o números en mayúsculas, sin espacios ni símbolos.';
  else if (existentes.codigos.includes(d.codigoCorto)) e.codigoCorto = 'Ese código ya lo usa otro cliente.';

  if (vacio(d.direccionFiscal)) e.direccionFiscal = OBLIGATORIO;
  if (vacio(d.giro)) e.giro = OBLIGATORIO;
  if (vacio(d.contactoNombre)) e.contactoNombre = OBLIGATORIO;
  if (vacio(d.contactoCargo)) e.contactoCargo = OBLIGATORIO;

  if (vacio(d.contactoTelefono)) e.contactoTelefono = OBLIGATORIO;
  else if (!telefonoValido(d.contactoTelefono)) e.contactoTelefono = 'Ingrese un teléfono de al menos 6 dígitos.';

  if (vacio(d.contactoCorreo)) e.contactoCorreo = OBLIGATORIO;
  else if (!RE_CORREO.test(d.contactoCorreo.trim())) e.contactoCorreo = 'Ingrese un correo válido, por ejemplo nombre@empresa.pe.';

  return e;
}

export interface DatosProyecto {
  nombre: string;
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoTelefono: string;
  estado: EstadoActivoInactivo;
  observaciones: string;
}

export function validarProyecto(d: DatosProyecto, nombresDelCliente: string[]): Errores<keyof DatosProyecto> {
  const e: Errores<keyof DatosProyecto> = {};

  if (vacio(d.nombre)) e.nombre = OBLIGATORIO;
  else if (!RE_NOMBRE_SEDE.test(d.nombre)) e.nombre = 'De 4 a 20 caracteres en mayúsculas, sin espacios (ej. PLANTA, CSF_SUNNY).';
  else if (nombresDelCliente.includes(d.nombre)) e.nombre = 'Este cliente ya tiene una sede con ese nombre.';

  if (vacio(d.direccion)) e.direccion = OBLIGATORIO;
  if (vacio(d.distrito)) e.distrito = OBLIGATORIO;
  if (vacio(d.provincia)) e.provincia = OBLIGATORIO;
  if (vacio(d.departamento)) e.departamento = OBLIGATORIO;
  if (vacio(d.contactoNombre)) e.contactoNombre = OBLIGATORIO;
  if (vacio(d.contactoCargo)) e.contactoCargo = OBLIGATORIO;

  if (vacio(d.contactoTelefono)) e.contactoTelefono = OBLIGATORIO;
  else if (!telefonoValido(d.contactoTelefono)) e.contactoTelefono = 'Ingrese un teléfono de al menos 6 dígitos.';

  return e;
}

export interface DatosServicio {
  tipo: TipoServicio | '';
  frecuencia: string;
  areaTotal: string;
  areaTratar: string;
  insumos: string[];
  /** Dosis referencial por insumo elegido, indexada por id de insumo (§7.3). */
  dosis: Record<string, string>;
  equipos: string[];
  requiereCertificado: boolean | null;
  vigenciaDesde: string;
  vigenciaHasta: string;
  observaciones: string;
  estado: EstadoActivoInactivo;
}

export function validarServicio(d: DatosServicio): Errores<keyof DatosServicio> {
  const e: Errores<keyof DatosServicio> = {};

  if (d.tipo === '') e.tipo = OBLIGATORIO;
  if (vacio(d.frecuencia)) e.frecuencia = OBLIGATORIO;

  const total = Number(d.areaTotal);
  const tratar = Number(d.areaTratar);
  if (vacio(d.areaTotal)) e.areaTotal = OBLIGATORIO;
  else if (!(total > 0)) e.areaTotal = 'Ingrese una superficie mayor a 0 m².';
  if (vacio(d.areaTratar)) e.areaTratar = OBLIGATORIO;
  else if (!(tratar > 0)) e.areaTratar = 'Ingrese una superficie mayor a 0 m².';
  else if (total > 0 && tratar > total) e.areaTratar = 'No puede superar el área total del local.';

  if (d.insumos.length === 0) e.insumos = 'Seleccione al menos un insumo autorizado.';
  else if (d.insumos.some((id) => vacio(d.dosis[id] ?? ''))) e.dosis = 'Indique la dosis de cada insumo seleccionado.';

  if (d.equipos.length === 0) e.equipos = 'Seleccione al menos un equipo.';

  if (d.requiereCertificado === null) e.requiereCertificado = 'Indique si el servicio requiere certificado.';
  else if (d.requiereCertificado) {
    if (vacio(d.vigenciaDesde)) e.vigenciaDesde = OBLIGATORIO;
    if (vacio(d.vigenciaHasta)) e.vigenciaHasta = OBLIGATORIO;
    else if (!vacio(d.vigenciaDesde) && d.vigenciaHasta <= d.vigenciaDesde)
      e.vigenciaHasta = 'El fin de la vigencia debe ser posterior al inicio.';
  }

  return e;
}
