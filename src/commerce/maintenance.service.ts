import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource, LessThan } from 'typeorm';
import { AfterSale, Order } from './entities';
import { OrdersService } from './orders.service';
import { AfterSalesService } from './aftersales.service';

@Injectable()
export class CommerceMaintenance implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private readonly log = new Logger(CommerceMaintenance.name);
  constructor(private readonly db: DataSource, private readonly orders: OrdersService, private readonly sales: AfterSalesService) {}
  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      if (!this.running) this.running = this.sweep().catch(() => { this.log.error('Commerce expiry sweep failed; will retry'); }).finally(() => { this.running = undefined; });
    }, 30000);
    this.timer.unref();
  }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.running; }
  async sweep() {
    const pending = await this.db.getRepository(Order).find({ where: { status: 'PENDING_PAYMENT', paymentDeadlineAt: LessThan(new Date()) }, take: 100, order: { paymentDeadlineAt: 'ASC' } });
    for (const order of pending) await this.orders.expireOrder(order.id);
    const returns = await this.db.getRepository(AfterSale).find({ where: { status: 'AWAITING_RETURN', returnDeadlineAt: LessThan(new Date()) }, take: 100, order: { returnDeadlineAt: 'ASC' } });
    for (const sale of returns) await this.sales.expire(sale.id);
  }
}
