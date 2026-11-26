import { Inject, Injectable } from '@nestjs/common';
import type { InspeccionRegistrada } from '@gafer/contracts';
import { Kysely, sql } from 'kysely';
import { KYSELY_DATABASE } from '../../database/database.module';
import { GaferDatabase } from '../../database/types';
import { EventoEstacion, LIMITES_MAPA, Punto } from '../domain/mapa';
import {
  MapaRepository,
  PlanoMapa,
  VisitaDelPlanoGuardada,
  VisitaProgramadaMapa,
} from '../domain/ports/mapa.repository';
import { ConflictoMapaError, LimiteMapaExcedidoError } from '../domain/registro-visita';

/** Traduce una violación de las restricciones de la migración 008 a un error de dominio con mensaje claro. */
function traducirErrorDeBase(error: unknown): unknown {
  const e = error as { code?: string; constraint?: string };
  switch (e?.constraint) {
    case 'planos_limite_por_proyecto':
      return new LimiteMapaExcedidoError(`Un proyecto admite hasta ${LIMITES_MAPA.planosPorProyecto} planos`);
    case 'mapa_estaciones_limite_por_plano':
      return new LimiteMapaExcedidoError(`Un plano admite hasta ${LIMITES_MAPA.estacionesPorPlano} estaciones (numeradas del 1 al ${LIMITES_MAPA.estacionesPorPlano})`);
    case 'uq_plano_proyecto_nombre':
      return new ConflictoMapaError('Ya existe un plano con ese nombre en el proyecto');
    case 'uq_mapa_estacion_plano_numero':
      return new ConflictoMapaError('El número de estación ya lo usa otra estación del plano');
    case 'mapa_visita_inmutable':
      return new ConflictoMapaError('La visita está en revisión: su mapa no se puede modificar');
    case 'mapa_visita_mismo_proyecto':
      return new ConflictoMapaError('La visita y el plano no son del mismo proyecto');
    default:
      return error;
  }
}

const hhmm = (hora: string) => hora.slice(0, 5);

@Injectable()
export class KyselyMapaRepository implements MapaRepository {
  constructor(@Inject(KYSELY_DATABASE) private readonly db: Kysely<GaferDatabase>) {}

  async proyectoExiste(proyectoId: string): Promise<boolean> {
    const fila = await this.db.selectFrom('proyectos').select('id').where('id', '=', proyectoId).executeTakeFirst();
    return fila !== undefined;
  }

  async contarPlanos(proyectoId: string): Promise<number> {
    const fila = await this.db
      .selectFrom('planos')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('proyecto_id', '=', proyectoId)
      .executeTakeFirstOrThrow();
    return Number(fila.total);
  }

  async crearPlano(plano: PlanoMapa): Promise<void> {
    try {
      await this.db
        .insertInto('planos')
        .values({
          id: plano.id,
          proyecto_id: plano.proyectoId,
          nombre: plano.nombre,
          puntos: JSON.stringify(plano.puntos),
          cerrado: plano.cerrado,
        })
        .execute();
    } catch (error) {
      throw traducirErrorDeBase(error);
    }
  }

  async buscarPlano(planoId: string): Promise<PlanoMapa | null> {
    const fila = await this.db.selectFrom('planos').selectAll().where('id', '=', planoId).executeTakeFirst();
    return fila ? this.aPlano(fila) : null;
  }

  async listarPlanos(proyectoId: string): Promise<PlanoMapa[]> {
    const filas = await this.db
      .selectFrom('planos')
      .selectAll()
      .where('proyecto_id', '=', proyectoId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return filas.map((f) => this.aPlano(f));
  }

  async buscarVisita(visitaId: string): Promise<VisitaProgramadaMapa | null> {
    const fila = await this.db
      .selectFrom('visitas')
      .select([
        'id',
        'proyecto_id',
        'estado_campo',
        sql<string>`to_char(fecha, 'YYYY-MM-DD')`.as('fecha'),
        sql<string>`to_char(hora, 'HH24:MI')`.as('hora'),
      ])
      .where('id', '=', visitaId)
      .executeTakeFirst();
    return fila
      ? { id: fila.id, proyectoId: fila.proyecto_id, fecha: fila.fecha, hora: fila.hora, estadoCampo: fila.estado_campo }
      : null;
  }

  async historialDelPlano(planoId: string): Promise<VisitaDelPlanoGuardada[]> {
    return this.leerHistorial(this.db, planoId);
  }

  async registrarEnVisita(
    planoId: string,
    visitaId: string,
    decidir: (historial: VisitaDelPlanoGuardada[]) => EventoEstacion[],
  ): Promise<void> {
    try {
      await this.db.transaction().execute(async (trx) => {
        // Serializa las escrituras del plano: dos técnicos no pueden calcular sobre el mismo estado a la vez.
        await trx.selectFrom('planos').select('id').where('id', '=', planoId).forNoKeyUpdate().executeTakeFirstOrThrow();

        const historial = (await this.leerHistorial(trx, planoId)).filter((v) => v.id !== visitaId);
        const eventos = decidir(historial);

        await trx
          .deleteFrom('mapa_visita_estaciones')
          .where('visita_id', '=', visitaId)
          .where('plano_id', '=', planoId)
          .execute();

        for (const e of eventos) {
          await trx
            .insertInto('mapa_estaciones')
            .values({ id: e.estacionId, plano_id: planoId, numero: e.numero, tipo_estacion: e.tipoEstacion })
            .onConflict((oc) => oc.column('id').doNothing())
            .execute();
        }

        if (eventos.length > 0) {
          await trx
            .insertInto('mapa_visita_estaciones')
            .values(
              eventos.map((e) => ({
                visita_id: visitaId,
                estacion_id: e.estacionId,
                plano_id: planoId,
                pos_x: e.posicion.x,
                pos_y: e.posicion.y,
                instalada: e.instalada,
                reubicada_desde_x: e.reubicadaDesde?.x ?? null,
                reubicada_desde_y: e.reubicadaDesde?.y ?? null,
                inspeccion: e.inspeccion ? JSON.stringify(sinFecha(e.inspeccion)) : null,
              })),
            )
            .execute();
        }
      });
    } catch (error) {
      throw traducirErrorDeBase(error);
    }
  }

  private async leerHistorial(ex: Kysely<GaferDatabase>, planoId: string): Promise<VisitaDelPlanoGuardada[]> {
    const filas = await ex
      .selectFrom('mapa_visita_estaciones as mv')
      .innerJoin('mapa_estaciones as me', 'me.id', 'mv.estacion_id')
      .innerJoin('visitas as v', 'v.id', 'mv.visita_id')
      .leftJoin('personal as p', 'p.id', 'v.tecnico_titular_id')
      .select([
        'mv.visita_id',
        'mv.estacion_id',
        'mv.pos_x',
        'mv.pos_y',
        'mv.instalada',
        'mv.reubicada_desde_x',
        'mv.reubicada_desde_y',
        'mv.inspeccion',
        'me.numero',
        'me.tipo_estacion',
        sql<string>`to_char(v.fecha, 'YYYY-MM-DD')`.as('fecha'),
        sql<string>`to_char(v.hora, 'HH24:MI')`.as('hora'),
        sql<string>`coalesce(p.nombres || ' ' || p.apellidos, '')`.as('tecnico'),
      ])
      .where('mv.plano_id', '=', planoId)
      .orderBy('v.fecha')
      .orderBy('v.hora')
      .orderBy('v.id')
      .orderBy('me.numero')
      .execute();

    const visitas: VisitaDelPlanoGuardada[] = [];
    for (const f of filas) {
      let visita = visitas[visitas.length - 1];
      if (!visita || visita.id !== f.visita_id) {
        visita = { id: f.visita_id, fecha: f.fecha, hora: hhmm(f.hora), tecnico: f.tecnico, eventos: [] };
        visitas.push(visita);
      }
      const inspeccion = f.inspeccion as Omit<InspeccionRegistrada, 'fecha'> | null;
      visita.eventos.push({
        estacionId: f.estacion_id,
        numero: f.numero,
        planoId,
        tipoEstacion: f.tipo_estacion,
        posicion: { x: f.pos_x, y: f.pos_y },
        instalada: f.instalada,
        reubicadaDesde:
          f.reubicada_desde_x === null || f.reubicada_desde_y === null ? null : ({ x: f.reubicada_desde_x, y: f.reubicada_desde_y } satisfies Punto),
        inspeccion: inspeccion ? { ...inspeccion, fecha: f.fecha } : null,
      });
    }
    return visitas;
  }

  private aPlano(fila: { id: string; proyecto_id: string; nombre: string; puntos: unknown; cerrado: boolean }): PlanoMapa {
    return {
      id: fila.id,
      proyectoId: fila.proyecto_id,
      nombre: fila.nombre,
      puntos: fila.puntos as Punto[],
      cerrado: fila.cerrado,
    };
  }
}

function sinFecha(inspeccion: InspeccionRegistrada): Omit<InspeccionRegistrada, 'fecha'> {
  const { fecha: _fecha, ...resto } = inspeccion;
  return resto;
}
