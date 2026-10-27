import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../common/http';
import { AuditLog, LogisticsEvent, Order, Shipment } from './entities';
import { Actor, checkVersion, CommerceTransaction, conflict, hash, missing, touch } from './transaction';
import { logisticsConfig, LogisticsProvider, LogisticsProviderError, TrackingResult } from './logistics-provider';
import { OrdersService } from './orders.service';

@Injectable()
export class LogisticsService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private readonly log = new Logger(LogisticsService.name);
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction,
    private readonly orders: OrdersService, private readonly provider: LogisticsProvider) {}

  async read(orderId: string, userId?: string) {
    // Ownership must be checked before ANY paid upstream request.
    if (!await this.db.getRepository(Order).existsBy({ id: orderId, ...(userId ? { userId } : {}) })) throw missing();
    const s = await this.db.getRepository(Shipment).findOneBy({ orderId });
    if (s) await this.sync(s.id);
    return this.orders.logistics(orderId, userId);
  }
  async refresh(actor: Actor, id: string, version: number) {
    await this.sync(id, { actor, version });
    const s = await this.db.getRepository(Shipment).findOneBy({ id }); if (!s) throw missing();
    return this.orders.logistics(s.orderId);
  }
  private async lock(m: EntityManager, id: string) {
    const candidate = await m.findOneBy(Shipment, { id }); if (!candidate) throw missing();
    const o = await m.findOne(Order, { where: { id: candidate.orderId }, lock: { mode: 'pessimistic_write' } });
    if (!o) throw missing();
    const s = await m.findOne(Shipment, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!s) throw missing();
    return { s, o };
  }
  async sync(id: string, force?: { actor: Actor; version: number }): Promise<void> {
    const config = logisticsConfig();
    if (!config.enabled && !force) return;
    const claim = async (m: EntityManager) => {
      const { s, o } = await this.lock(m, id);
      if (force) checkVersion(s, force.version);
      if (!config.enabled) throw new ApiException(503, 'LOGISTICS_NOT_CONFIGURED', '物流查询服务尚未配置');
      if (o.type !== 'PRODUCT' || !['PENDING_RECEIPT', 'COMPLETED'].includes(o.status)) {
        if (force) conflict('SHIPMENT_STATE_INVALID', '当前订单无需查询出库物流');
        return null;
      }
      const now = new Date();
      if (s.syncLeaseUntil && s.syncLeaseUntil > now) return null;
      if (force && s.lastSyncAttemptAt && now.getTime() - s.lastSyncAttemptAt.getTime() < 60000) {
        throw new ApiException(429, 'LOGISTICS_REFRESH_TOO_FREQUENT', '同一运单两次主动查询至少间隔 60 秒');
      }
      if (!force && (['DELIVERED', 'RETURNED'].includes(s.status) ||
          s.shippedAt.getTime() < now.getTime() - config.maxDays * 86400000 ||
          (s.nextSyncAt && s.nextSyncAt > now))) return null;
      const token = randomUUID();
      s.syncLeaseToken = token; s.syncLeaseUntil = new Date(now.getTime() + 120000);
      s.lastSyncAttemptAt = now;
      // A persistent lease prevents duplicate billed requests across processes/restarts.
      await m.save(s);
      if (force) await this.tx.audit(m, force.actor, 'shipment.sync-request', s.id);
      return { id, token, version: s.version, carrierCode: s.carrierCode, trackingNo: s.trackingNo,
        phoneLast4: s.queryPhoneLast4 ?? o.address?.phone.slice(-4) ?? null };
    };
    const claimed = force ? await this.tx.run(force.actor, claim) : await this.db.transaction('READ COMMITTED', claim);
    if (!claimed) return;
    // Network I/O deliberately runs outside row locks / retryable transactions.
    let result: TrackingResult | undefined; let errorCode: string | null = null;
    try { result = await this.provider.query(claimed.carrierCode, claimed.trackingNo, claimed.phoneLast4); }
    catch (e) { errorCode = e instanceof LogisticsProviderError ? e.code : 'LOGISTICS_PROVIDER_UNAVAILABLE'; }
    await this.db.transaction('READ COMMITTED', async m => {
      const { s } = await this.lock(m, id);
      if (s.syncLeaseToken !== claimed.token) return;
      s.syncLeaseToken = null; s.syncLeaseUntil = null;
      if (s.version !== claimed.version) {
        // An admin correction/manual event won the race. Discard the entire obsolete response.
        s.nextSyncAt = new Date(Date.now() + 60000); await m.save(s); return;
      }
      const now = new Date();
      if (result) {
        const latest = await m.findOne(LogisticsEvent, { where: { shipmentId: id }, order: { time: 'DESC' } });
        const seen = new Set<string>();
        for (const event of result.events) {
          const eventKey = hash(JSON.stringify([event.time.toISOString(), event.description]));
          if (seen.has(eventKey)) continue;
          seen.add(eventKey);
          if (!await m.existsBy(LogisticsEvent, { shipmentId: id, eventKey })) await m.insert(LogisticsEvent, {
            id: randomUUID(), shipmentId: id, eventKey, time: event.time, description: event.description, location: null, source: 'ALIYUN',
          });
        }
        const latestTime = result.events[0].time;
        if ((!latest || latestTime >= latest.time) && !['DELIVERED', 'RETURNED'].includes(s.status)) {
          s.status = result.status;
          if (result.status === 'DELIVERED') s.deliveredAt = latestTime;
        }
        s.lastSyncedAt = now; s.syncStatus = 'UP_TO_DATE'; s.syncErrorCode = null; s.syncFailures = 0;
        s.nextSyncAt = ['DELIVERED', 'RETURNED'].includes(s.status) ? null : new Date(now.getTime() + config.intervalSeconds * 1000);
      } else {
        s.syncStatus = errorCode === 'LOGISTICS_NO_DATA' ? 'NO_DATA' : 'FAILED'; s.syncErrorCode = errorCode;
        s.syncFailures = Math.min(s.syncFailures + 1, 1000);
        const permanent = ['LOGISTICS_AUTH_FAILED', 'LOGISTICS_ACCESS_DENIED', 'LOGISTICS_IP_RESTRICTED'].includes(errorCode!);
        const seconds = permanent ? 21600 : errorCode === 'LOGISTICS_NO_DATA' ? config.intervalSeconds : Math.min(21600, 300 * 2 ** Math.min(s.syncFailures - 1, 7));
        s.nextSyncAt = new Date(now.getTime() + seconds * 1000);
      }
      touch(s); await m.save(s);
      await m.save(m.create(AuditLog, { id: randomUUID(), actorKey: 'system:logistics', action: 'shipment.sync-result',
        resourceId: id, details: { syncStatus: s.syncStatus, errorCode: s.syncErrorCode, status: s.status } }));
    });
  }
  async sweep() {
    const config = logisticsConfig(); if (!config.enabled) return;
    const now = new Date();
    const rows = await this.db.getRepository(Shipment).createQueryBuilder('s')
      .innerJoin(Order, 'o', 'o.id = s.orderId')
      .where('o.type = :type AND o.status IN (:...orders)', { type: 'PRODUCT', orders: ['PENDING_RECEIPT', 'COMPLETED'] })
      .andWhere('s.status NOT IN (:...terminal)', { terminal: ['DELIVERED', 'RETURNED'] })
      .andWhere('s.shippedAt >= :cutoff', { cutoff: new Date(now.getTime() - config.maxDays * 86400000) })
      .andWhere('(s.nextSyncAt IS NULL OR s.nextSyncAt <= :now)', { now })
      .andWhere('(s.syncLeaseUntil IS NULL OR s.syncLeaseUntil <= :now)', { now })
      .orderBy('s.nextSyncAt', 'ASC').addOrderBy('s.id', 'ASC').take(config.batchSize).getMany();
    for (const s of rows) {
      try { await this.sync(s.id); } catch { this.log.error('Shipment tracking sync failed; will retry'); }
    }
  }
  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test' || !logisticsConfig().enabled) return;
    this.timer = setInterval(() => {
      if (!this.running) this.running = this.sweep().catch(() => this.log.error('Logistics sweep failed; will retry'))
        .finally(() => { this.running = undefined; });
    }, 60000); this.timer.unref();
  }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.running; }
}
