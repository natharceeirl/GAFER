import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STOCK_REPOSITORY, StockRepository } from '../domain/ports/stock.repository';
import { NOTIFICATION_PORT, NotificationPort } from '../../shared/ports/notification.port';

/**
 * Se dispara al escuchar el evento InspeccionCerrada de `operaciones`
 * (ver apps/worker) — el consumo de insumos se descuenta automáticamente
 * al cerrar el servicio, sin intervención manual.
 */
@Injectable()
export class DescontarStockUseCase {
  constructor(
    @Inject(STOCK_REPOSITORY) private readonly repo: StockRepository,
    @Inject(NOTIFICATION_PORT) private readonly notificaciones: NotificationPort,
  ) {}

  async ejecutar(insumoId: string, cantidad: number): Promise<void> {
    const stock = await this.repo.buscarPorInsumoId(insumoId);
    if (!stock) {
      throw new NotFoundException(`No hay stock registrado para el insumo ${insumoId}`);
    }
    stock.descontar(cantidad);
    await this.repo.guardar(stock);

    if (stock.necesitaAlerta()) {
      await this.notificaciones.notificar('Stock bajo el umbral mínimo', {
        insumoId,
        cantidadDisponible: stock.getCantidadDisponible(),
      });
    }
  }
}
