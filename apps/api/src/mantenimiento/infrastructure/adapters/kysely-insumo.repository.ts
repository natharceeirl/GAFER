import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { Insumo, PresentacionInsumo, UnidadMedidaInsumo } from '../../domain/insumo';
import { EstadoGeneral } from '../../domain/cliente';
import { InsumoRepository } from '../../domain/ports/insumo.repository';

@Injectable()
export class KyselyInsumoRepository implements InsumoRepository {
  constructor(private readonly db: Kysely<GaferDatabase>) {}

  async guardar(insumo: Insumo): Promise<void> {
    await this.db
      .insertInto('insumos')
      .values({
        id: insumo.id,
        nombre_comercial: insumo.nombreComercial,
        principio_activo: insumo.principioActivo,
        presentacion: insumo.presentacion,
        unidad_medida: insumo.unidadMedida,
        registro_digesa: insumo.registroDigesa,
        concentracion: insumo.concentracion,
        dosis_estandar: insumo.dosisEstandar,
        ficha_tecnica_key: insumo.fichaTecnicaKey,
        hoja_msds_key: insumo.hojaMsdsKey,
        resolucion_key: insumo.resolucionKey,
        proveedor: insumo.proveedor,
        estado: insumo.getEstado(),
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          nombre_comercial: insumo.nombreComercial,
          principio_activo: insumo.principioActivo,
          presentacion: insumo.presentacion,
          unidad_medida: insumo.unidadMedida,
          registro_digesa: insumo.registroDigesa,
          concentracion: insumo.concentracion,
          dosis_estandar: insumo.dosisEstandar,
          ficha_tecnica_key: insumo.fichaTecnicaKey,
          hoja_msds_key: insumo.hojaMsdsKey,
          resolucion_key: insumo.resolucionKey,
          proveedor: insumo.proveedor,
          estado: insumo.getEstado(),
        }),
      )
      .execute();
  }

  async buscarPorId(id: string): Promise<Insumo | null> {
    const row = await this.db
      .selectFrom('insumos')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorDigesa(registroDigesa: string): Promise<Insumo | null> {
    const row = await this.db
      .selectFrom('insumos')
      .selectAll()
      .where('registro_digesa', '=', registroDigesa)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async listarActivos(): Promise<Insumo[]> {
    const rows = await this.db
      .selectFrom('insumos')
      .selectAll()
      .where('estado', '=', 'ACTIVO')
      .orderBy('nombre_comercial', 'asc')
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): Insumo {
    return new Insumo({
      id: row.id,
      nombreComercial: row.nombre_comercial,
      principioActivo: row.principio_activo,
      presentacion: row.presentacion as PresentacionInsumo,
      unidadMedida: row.unidad_medida as UnidadMedidaInsumo,
      registroDigesa: row.registro_digesa,
      concentracion: row.concentracion,
      dosisEstandar: row.dosis_estandar,
      fichaTecnicaKey: row.ficha_tecnica_key,
      hojaMsdsKey: row.hoja_msds_key,
      resolucionKey: row.resolucion_key,
      proveedor: row.proveedor,
      estado: row.estado as EstadoGeneral,
    });
  }
}
