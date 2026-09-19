import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { ServicioContratado, TipoServicio, FrecuenciaServicio } from '../../domain/servicio-contratado';
import { EstadoGeneral } from '../../domain/cliente';
import { ServicioContratadoRepository } from '../../domain/ports/servicio-contratado.repository';

@Injectable()
export class KyselyServicioContratadoRepository implements ServicioContratadoRepository {
  constructor(private readonly db: Kysely<GaferDatabase>) {}

  async guardar(servicio: ServicioContratado): Promise<void> {
    await this.db
      .insertInto('servicios_contratados')
      .values({
        id: servicio.id,
        proyecto_id: servicio.proyectoId,
        tipo_servicio: servicio.tipoServicio,
        frecuencia: servicio.frecuencia,
        area_total_m2: servicio.areaTotalM2,
        area_tratar_m2: servicio.areaTratarM2,
        insumos_autorizados: JSON.stringify(servicio.insumosAutorizados),
        equipos_autorizados: JSON.stringify(servicio.equiposAutorizados),
        dosis_referencial: JSON.stringify(servicio.dosisReferencial),
        requiere_certificado: servicio.requiereCertificado,
        vigencia_dias: servicio.vigenciaDias,
        estado: servicio.getEstado(),
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          tipo_servicio: servicio.tipoServicio,
          frecuencia: servicio.frecuencia,
          area_total_m2: servicio.areaTotalM2,
          area_tratar_m2: servicio.areaTratarM2,
          insumos_autorizados: JSON.stringify(servicio.insumosAutorizados),
          equipos_autorizados: JSON.stringify(servicio.equiposAutorizados),
          dosis_referencial: JSON.stringify(servicio.dosisReferencial),
          requiere_certificado: servicio.requiereCertificado,
          vigencia_dias: servicio.vigenciaDias,
          estado: servicio.getEstado(),
        }),
      )
      .execute();
  }

  async buscarPorId(id: string): Promise<ServicioContratado | null> {
    const row = await this.db
      .selectFrom('servicios_contratados')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorProyectoId(proyectoId: string): Promise<ServicioContratado[]> {
    const rows = await this.db
      .selectFrom('servicios_contratados')
      .selectAll()
      .where('proyecto_id', '=', proyectoId)
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): ServicioContratado {
    const insumosAutorizados =
      typeof row.insumos_autorizados === 'string'
        ? JSON.parse(row.insumos_autorizados)
        : (row.insumos_autorizados ?? []);

    const equiposAutorizados =
      typeof row.equipos_autorizados === 'string'
        ? JSON.parse(row.equipos_autorizados)
        : (row.equipos_autorizados ?? []);

    const dosisReferencial =
      typeof row.dosis_referencial === 'string'
        ? JSON.parse(row.dosis_referencial)
        : (row.dosis_referencial ?? {});

    return new ServicioContratado({
      id: row.id,
      proyectoId: row.proyecto_id,
      tipoServicio: row.tipo_servicio as TipoServicio,
      frecuencia: row.frecuencia as FrecuenciaServicio,
      areaTotalM2: Number(row.area_total_m2),
      areaTratarM2: Number(row.area_tratar_m2),
      insumosAutorizados,
      equiposAutorizados,
      dosisReferencial,
      requiereCertificado: Boolean(row.requiere_certificado),
      vigenciaDias: row.vigencia_dias ? Number(row.vigencia_dias) : null,
      estado: row.estado as EstadoGeneral,
    });
  }
}
