import { Module } from '@nestjs/common';
import { InventarioController } from './infrastructure/inventario.controller';
import { DescontarStockUseCase } from './application/descontar-stock.usecase';
import { STOCK_REPOSITORY } from './domain/ports/stock.repository';
import { StockRepositoryMemory } from './infrastructure/stock.repository.memory';
import { NOTIFICATION_PORT } from '../shared/ports/notification.port';
import { NotificationConsole } from '../shared/infrastructure/notification.console';

@Module({
  controllers: [InventarioController],
  providers: [
    DescontarStockUseCase,
    { provide: STOCK_REPOSITORY, useClass: StockRepositoryMemory },
    { provide: NOTIFICATION_PORT, useClass: NotificationConsole },
  ],
  exports: [DescontarStockUseCase],
})
export class InventarioModule {}
