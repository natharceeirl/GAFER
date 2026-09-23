import type { EstadoDocumento } from '@gafer/contracts';
import type { Rol } from '../../auth/model/roles';
import type { EventoAuditoria } from '../../auditoria/model/evento';
import type { Insumo } from '../../mantenimiento/model/tipos';
import type { DocumentoDetalle } from './tipos';

export const MAX_FOTOS_PDF = 20;

export type CampoEditable = 'diagnostico' | 'trabajosRealizados' | 'observaciones' | 'recomendaciones';

export const ETIQUETA_CAMPO: Record<CampoEditable, string> = {
  diagnostico: 'Diagnóstico',
  trabajosRealizados: 'Trabajos realizados',
  observaciones: 'Observaciones',
  recomendaciones: 'Recomendaciones',
};

/** Configurado una sola vez en Mantenimiento y estampado al aprobar (C7). */
export interface DirectorTecnico {
  nombre: string;
  cip: string;
  firma: string | null;
}

interface Contexto {
  usuario: string;
  rol: Rol;
  fechaHora: string;
}

function evento(ctx: Contexto, doc: DocumentoDetalle, parcial: Omit<EventoAuditoria, 'id' | 'fechaHora' | 'usuario' | 'rol' | 'referencia'>): EventoAuditoria {
  return {
    id: `${ctx.fechaHora}-${doc.id}-${parcial.accion}-${parcial.campo ?? ''}`,
    fechaHora: ctx.fechaHora,
    usuario: ctx.usuario,
    rol: ctx.rol,
    referencia: doc.codigo,
    ...parcial,
  };
}

/** Aprobar u observar: Administrador y Supervisor (decisión C2). */
export function puedeDecidir(estado: EstadoDocumento): boolean {
  return estado === 'ENVIADO_A_REVISION';
}

/** Intervención post-cierre con clave, antes de aprobar: Administrador y Supervisor (decisión C3). */
export function puedeIntervenir(estado: EstadoDocumento): boolean {
  return estado === 'ENVIADO_A_REVISION' || estado === 'OBSERVADO';
}

/** Solo el Administrador modifica un documento aprobado (decisión C4). */
export function puedeModificarAprobado(rol: Rol, estado: EstadoDocumento): boolean {
  return rol === 'ADMINISTRADOR' && estado === 'APROBADO';
}

export function fotosDisponibles(doc: DocumentoDetalle): number {
  return Math.min(doc.fotos, doc.fotosRecibidas ?? doc.fotos);
}

export function seleccionInicialFotos(doc: DocumentoDetalle): number[] {
  return Array.from({ length: Math.min(MAX_FOTOS_PDF, fotosDisponibles(doc)) }, (_, i) => i);
}

export function validarSeleccionFotos(seleccion: number[]): string | null {
  return seleccion.length > MAX_FOTOS_PDF ? `El PDF admite hasta ${MAX_FOTOS_PDF} fotos; quite ${seleccion.length - MAX_FOTOS_PDF}.` : null;
}

/**
 * Anexos concatenados automáticamente (decisión C14): ficha técnica y MSDS
 * de cada insumo consumido, tomados del catálogo, más la licencia de GAFER.
 */
export function anexosAutomaticos(doc: DocumentoDetalle, insumos: Insumo[]): string[] {
  const usados = insumos.filter((cat) =>
    doc.insumosUsados.some((u) => u.producto.toLowerCase().startsWith(cat.principioActivo.toLowerCase())),
  );
  return [
    ...usados.flatMap((cat) => [`Ficha técnica — ${cat.nombre}`, `MSDS — ${cat.nombre}`]),
    'Resolución de licencia sanitaria de GAFER',
  ];
}

export function aprobar(
  doc: DocumentoDetalle,
  args: Contexto & { fotosSeleccionadas: number[]; insumos: Insumo[]; director: DirectorTecnico | null },
): { documento: DocumentoDetalle; evento: EventoAuditoria } {
  if (!puedeDecidir(doc.estado)) throw new Error('Solo se aprueban documentos en revisión.');
  if (!args.director) throw new Error('Configure al Director Técnico en Mantenimiento antes de aprobar.');
  const errorFotos = validarSeleccionFotos(args.fotosSeleccionadas);
  if (errorFotos) throw new Error(errorFotos);

  const generados = [`${doc.codigo}.pdf`];
  if (doc.numeroCertificado !== '—') generados.push(`${doc.numeroCertificado}.pdf`);

  const documento: DocumentoDetalle = {
    ...doc,
    estado: 'APROBADO',
    fotosSeleccionadas: args.fotosSeleccionadas,
    firmaDirector: `${args.director.nombre} · CIP ${args.director.cip}`,
    generados,
    anexos: anexosAutomaticos(doc, args.insumos),
  };
  return {
    documento,
    evento: evento(args, doc, {
      accion: 'Aprobación',
      detalle: `${args.fotosSeleccionadas.length} fotos en el PDF · genera ${generados.join(' y ')}`,
    }),
  };
}

export function observar(doc: DocumentoDetalle, args: Contexto & { comentario: string }): { documento: DocumentoDetalle; evento: EventoAuditoria } {
  if (!puedeDecidir(doc.estado)) throw new Error('Solo se observan documentos en revisión.');
  if (args.comentario.trim() === '') throw new Error('Indique qué debe corregirse.');
  return {
    documento: { ...doc, estado: 'OBSERVADO', comentarioObservacion: args.comentario.trim() },
    evento: evento(args, doc, { accion: 'Observación', detalle: args.comentario.trim() }),
  };
}

function aplicarCambios(doc: DocumentoDetalle, cambios: Partial<Record<CampoEditable, string>>) {
  const modificados = (Object.keys(cambios) as CampoEditable[]).filter((c) => (cambios[c] ?? doc[c]).trim() !== doc[c].trim());
  const documento = { ...doc };
  for (const c of modificados) documento[c] = (cambios[c] ?? '').trim();
  return { documento, modificados };
}

export function intervenir(
  doc: DocumentoDetalle,
  cambios: Partial<Record<CampoEditable, string>>,
  ctx: Contexto,
): { documento: DocumentoDetalle; eventos: EventoAuditoria[] } {
  if (!puedeIntervenir(doc.estado)) throw new Error('Este documento ya no admite intervención post-cierre.');
  const { documento, modificados } = aplicarCambios(doc, cambios);
  if (modificados.length === 0) throw new Error('No hay cambios para guardar.');
  return {
    documento: { ...documento, estado: 'ENVIADO_A_REVISION' },
    eventos: modificados.map((c) =>
      evento(ctx, doc, {
        accion: 'Intervención post-cierre',
        detalle: doc.estado === 'OBSERVADO' ? 'Corrección de documento observado; vuelve a revisión' : 'Corrección antes de aprobar',
        campo: ETIQUETA_CAMPO[c],
        valorAnterior: doc[c],
        valorNuevo: documento[c],
      }),
    ),
  };
}

export function modificarAprobado(
  doc: DocumentoDetalle,
  cambios: Partial<Record<CampoEditable, string>>,
  ctx: Contexto & { motivo: string },
): { documento: DocumentoDetalle; eventos: EventoAuditoria[] } {
  if (!puedeModificarAprobado(ctx.rol, doc.estado)) throw new Error('Solo el Administrador modifica documentos aprobados.');
  if (ctx.motivo.trim() === '') throw new Error('Seleccione el motivo de la modificación.');
  const { documento, modificados } = aplicarCambios(doc, cambios);
  if (modificados.length === 0) throw new Error('No hay cambios para guardar.');
  return {
    documento,
    eventos: modificados.map((c) =>
      evento(ctx, doc, {
        accion: 'Modificación post-aprobación',
        detalle: `Motivo: ${ctx.motivo}`,
        campo: ETIQUETA_CAMPO[c],
        valorAnterior: doc[c],
        valorNuevo: documento[c],
        autorizo: ctx.usuario,
        ejecuto: ctx.usuario,
      }),
    ),
  };
}

export function marcarEnviado(doc: DocumentoDetalle, ctx: Contexto): { documento: DocumentoDetalle; evento: EventoAuditoria } {
  if (doc.estado !== 'APROBADO') throw new Error('Solo se envían documentos aprobados.');
  return {
    documento: { ...doc, estado: 'ENVIADO' },
    evento: evento(ctx, doc, { accion: 'Envío al cliente', detalle: (doc.generados ?? [`${doc.codigo}.pdf`]).join(', ') }),
  };
}
