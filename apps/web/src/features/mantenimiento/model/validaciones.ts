import { EquipoRegistroSchema, InsumoRegistroSchema } from '@gafer/contracts';
import type { Errores } from '../../cliente-expediente/model/validaciones';
import { campoDeRutaEquipo, registroDeEquipo, type DatosEquipo } from './equipo-mapper';
import { campoDeRutaInsumo, registroDeInsumo, type DatosInsumo } from './insumo-mapper';

const OBLIGATORIO = 'Campo obligatorio.';

const vacio = (v: string) => v.trim() === '';

const normalizarRegistro = (v: string) => v.trim().toUpperCase();

/**
 * Valida el insumo con el esquema de alta de `@gafer/contracts` (el mismo del API). Los textos de los esquemas
 * ya vienen en español; solo se completan los genéricos de zod. La unicidad del registro DIGESA se revisa aquí
 * contra los registros de los demás insumos ya cargados, porque el API solo la comprueba en el alta (409) y no en
 * la edición.
 */
export function validarInsumo(d: DatosInsumo, registrosDeOtrosInsumos: string[] = []): Errores<keyof DatosInsumo> {
  const e: Errores<keyof DatosInsumo> = {};
  const resultado = InsumoRegistroSchema.safeParse(registroDeInsumo(d));

  if (!resultado.success) {
    for (const incidencia of resultado.error.issues) {
      const campo = campoDeRutaInsumo(String(incidencia.path[0]));
      if (!campo || e[campo]) continue;
      e[campo] = incidencia.code === 'too_small' || incidencia.code === 'invalid_type' || incidencia.code === 'invalid_enum_value' ? OBLIGATORIO : incidencia.message;
    }
  }
  const registro = normalizarRegistro(d.registroDigesa);
  if (!e.registroDigesa && registro !== '' && registrosDeOtrosInsumos.some((r) => normalizarRegistro(r) === registro)) {
    e.registroDigesa = 'Ya existe un insumo con ese registro DIGESA.';
  }
  // El cuerpo se arma con la presentación y la unidad ya elegidas; un valor vacío lo rechaza el esquema como enum inválido.
  if (d.presentacion === '') e.presentacion = OBLIGATORIO;
  if (d.unidadMedida === '') e.unidadMedida = OBLIGATORIO;
  if (d.fichaTecnicaKey === '') e.fichaTecnicaKey = 'Cargue la ficha técnica en formato PDF.';
  if (d.hojaMsdsKey === '') e.hojaMsdsKey = 'Cargue la hoja MSDS en formato PDF.';
  return e;
}

/** Valida el equipo con el esquema de alta de `@gafer/contracts`. La unicidad del código interno la resuelve el servidor (409). */
export function validarEquipo(d: DatosEquipo): Errores<keyof DatosEquipo> {
  const e: Errores<keyof DatosEquipo> = {};
  const resultado = EquipoRegistroSchema.safeParse(registroDeEquipo(d));
  if (resultado.success) return e;

  for (const incidencia of resultado.error.issues) {
    const campo = campoDeRutaEquipo(String(incidencia.path[0]));
    if (!campo || e[campo]) continue;
    e[campo] = incidencia.code === 'too_small' || incidencia.code === 'invalid_type' || incidencia.code === 'invalid_enum_value' ? OBLIGATORIO : incidencia.message;
  }
  if (d.tipo === '') e.tipo = OBLIGATORIO;
  if (vacio(d.codigoInterno)) e.codigoInterno = OBLIGATORIO;
  if (vacio(d.nombre)) e.nombre = OBLIGATORIO;
  return e;
}

/** Tamaño máximo de una ficha técnica o MSDS: 10 MB, de sobra para un PDF escaneado y sin riesgo para la subida directa. */
export const TAMANO_MAXIMO_PDF = 10 * 1024 * 1024;

/** Revisa en el navegador, antes de pedir la URL de subida, que el archivo sea un PDF de tamaño razonable. */
export function validarPdf(archivo: File): string | null {
  if (archivo.type !== 'application/pdf') return 'El archivo debe ser un PDF.';
  if (archivo.size === 0) return 'El archivo está vacío.';
  if (archivo.size > TAMANO_MAXIMO_PDF) return 'El PDF pesa más de 10 MB. Cargue uno más liviano.';
  return null;
}

export type CarpetaPdf = 'ficha-tecnica' | 'hoja-msds';

/**
 * Clave de almacenamiento de un PDF nuevo. Al subirlo el insumo puede no existir todavía (el alta exige las
 * claves), por eso la clave no lleva su id sino un identificador aleatorio.
 */
export function claveDePdf(carpeta: CarpetaPdf): string {
  return `insumos/${carpeta}/${crypto.randomUUID()}.pdf`;
}
