import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Inspeccion } from '../domain/inspeccion';
import {
  INSPECCION_REPOSITORY,
  InspeccionRepository,
} from '../domain/ports/inspeccion.repository';

@Injectable()
export class RegistrarInspeccionUseCase {
  constructor(
    @Inject(INSPECCION_REPOSITORY) private readonly repo: InspeccionRepository,
  ) {}

  async ejecutar(servicioId: string): Promise<Inspeccion> {
    const existente = await this.repo.buscarPorServicioId(servicioId);
    if (existente && existente.getEstado() === 'BORRADOR') {
      return existente;
    }

    try {
      const inspeccion = new Inspeccion(randomUUID(), servicioId);
      await this.repo.guardar(inspeccion);
      return inspeccion;
    } catch (error: any) {
      if (
        error?.code === '23505' ||
        error?.message?.includes('idx_inspecciones_servicio_borrador_unico')
      ) {
        const borrador = await this.repo.buscarPorServicioId(servicioId);
        if (borrador) {
          return borrador;
        }
      }
      throw error;
    }
  }
}
