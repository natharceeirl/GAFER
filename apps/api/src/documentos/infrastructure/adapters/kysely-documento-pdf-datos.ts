import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY_DATABASE } from '../../../database/database.module';
import { GaferDatabase } from '../../../database/types';
import {
  DatosInformePdf,
  DocumentoPdfDatosPort,
  EmpresaPdf,
  InspeccionPdf,
  PersonalPdf,
  ServicioPdf,
} from '../../domain/ports/pdf.ports';

/** Datos de GAFER que aún no tienen columnas propias viven en `configuracion_sistema.parametros.empresa`. */
function empresaDe(parametros: Record<string, unknown> | undefined): EmpresaPdf {
  const crudo = (parametros?.empresa ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  return {
    razonSocial: texto(crudo.razonSocial),
    ruc: texto(crudo.ruc),
    direccion: texto(crudo.direccion),
    telefono: texto(crudo.telefono),
  };
}

@Injectable()
export class KyselyDocumentoPdfDatos implements DocumentoPdfDatosPort {
  constructor(@Inject(KYSELY_DATABASE) private readonly db: Kysely<GaferDatabase>) {}

  async cargar(documentoId: string): Promise<DatosInformePdf | null> {
    const doc = await this.db
      .selectFrom('documentos as d')
      .innerJoin('clientes as c', 'c.id', 'd.cliente_id')
      .select([
        'd.id',
        'd.tipo',
        'd.codigo',
        'd.numero_correlativo',
        'd.estado',
        'd.proyecto_id',
        'd.inspeccion_id',
        sql<string>`to_char(d.fecha, 'YYYY-MM-DD')`.as('fecha'),
        'c.razon_social',
        'c.ruc',
        'c.direccion_fiscal',
        'c.giro_negocio',
        'c.contacto_nombre',
        'c.contacto_cargo',
        'c.contacto_telefono',
      ])
      .where('d.id', '=', documentoId)
      .executeTakeFirst();
    if (!doc) return null;

    const [config, sede, aprobacion] = await Promise.all([
      this.db.selectFrom('configuracion_sistema').select(['director_nombre', 'director_cip', 'parametros']).where('id', '=', 'global').executeTakeFirst(),
      doc.proyecto_id ? this.db.selectFrom('proyectos').selectAll().where('id', '=', doc.proyecto_id).executeTakeFirst() : undefined,
      this.db
        .selectFrom('documentos_transiciones')
        .select('actor_usuario')
        .where('documento_id', '=', documentoId)
        .where('estado_nuevo', '=', 'APROBADO')
        .orderBy('created_at', 'desc')
        .executeTakeFirst(),
    ]);

    const inspeccion = doc.inspeccion_id
      ? await this.db
          .selectFrom('inspecciones')
          .select([
            'codigo_inspeccion',
            'hora_inicio',
            'hora_fin',
            'tecnicos_participantes',
            'servicio_id',
            sql<string>`to_char(fecha_ejecucion, 'YYYY-MM-DD')`.as('fecha_ejecucion'),
          ])
          .where('id', '=', doc.inspeccion_id)
          .executeTakeFirst()
      : undefined;

    // Servicios de la sede; si el documento viene de una inspección, solo el servicio inspeccionado.
    let consultaServicios = this.db.selectFrom('servicios_contratados').selectAll().orderBy('created_at').orderBy('id');
    if (inspeccion) consultaServicios = consultaServicios.where('id', '=', inspeccion.servicio_id);
    else if (doc.proyecto_id) consultaServicios = consultaServicios.where('proyecto_id', '=', doc.proyecto_id).where('estado', '=', 'ACTIVO');
    const filasServicio = doc.proyecto_id || inspeccion ? await consultaServicios.execute() : [];

    const idsInsumo = [...new Set(filasServicio.flatMap((s) => s.insumos_autorizados))];
    const idsEquipo = [...new Set(filasServicio.flatMap((s) => s.equipos_autorizados))];
    const insumos = idsInsumo.length ? await this.db.selectFrom('insumos').selectAll().where('id', 'in', idsInsumo).execute() : [];
    const equipos = idsEquipo.length ? await this.db.selectFrom('equipos').select(['id', 'nombre', 'codigo_interno']).where('id', 'in', idsEquipo).execute() : [];

    const servicios: ServicioPdf[] = filasServicio.map((s) => ({
      tipoServicio: s.tipo_servicio,
      frecuencia: s.frecuencia,
      areaTotalM2: Number(s.area_total_m2),
      areaTratarM2: Number(s.area_tratar_m2),
      insumos: s.insumos_autorizados.flatMap((id) => {
        const i = insumos.find((x) => x.id === id);
        return i
          ? [{ producto: i.nombre_comercial, principioActivo: i.principio_activo, registroDigesa: i.registro_digesa, concentracion: i.concentracion, presentacion: i.presentacion }]
          : [];
      }),
      equipos: s.equipos_autorizados.flatMap((id) => {
        const e = equipos.find((x) => x.id === id);
        return e ? [`${e.nombre} (${e.codigo_interno})`] : [];
      }),
    }));

    const personal: PersonalPdf[] = (inspeccion?.tecnicos_participantes ?? []).map((t) => ({ nombre: t.nombre, cargo: 'Técnico Operador' }));
    const datosInspeccion: InspeccionPdf | null = inspeccion
      ? { codigo: inspeccion.codigo_inspeccion, fechaEjecucion: inspeccion.fecha_ejecucion, horaInicio: inspeccion.hora_inicio, horaFin: inspeccion.hora_fin }
      : null;

    return {
      documento: { id: doc.id, tipo: doc.tipo, codigo: doc.codigo, numeroCorrelativo: doc.numero_correlativo, estado: doc.estado, fecha: doc.fecha },
      empresa: empresaDe(config?.parametros),
      director: { nombre: config?.director_nombre ?? '', cip: config?.director_cip ?? '' },
      cliente: {
        razonSocial: doc.razon_social,
        ruc: doc.ruc,
        direccionFiscal: doc.direccion_fiscal,
        giroNegocio: doc.giro_negocio,
        contactoNombre: doc.contacto_nombre,
        contactoCargo: doc.contacto_cargo,
        contactoTelefono: doc.contacto_telefono,
      },
      sede: sede
        ? {
            nombre: sede.nombre,
            direccion: sede.direccion_sede,
            distrito: sede.distrito,
            provincia: sede.provincia,
            departamento: sede.departamento,
            contactoNombre: sede.contacto_nombre,
            contactoCargo: sede.contacto_cargo,
          }
        : null,
      servicios,
      personal,
      inspeccion: datosInspeccion,
      aprobadoPor: aprobacion?.actor_usuario ?? null,
      fotos: [],
    };
  }
}
