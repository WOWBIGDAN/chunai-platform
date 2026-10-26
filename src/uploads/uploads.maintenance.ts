import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UploadMedia } from './entities';
import { OssStorage } from './oss-storage';
import { UploadsService } from './uploads.service';
@Injectable()
export class UploadMaintenance implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private cursor?: { expiresAt: Date; id: string };
  private readonly log = new Logger(UploadMaintenance.name);
  constructor(private readonly db: DataSource, private readonly uploads: UploadsService, private readonly storage: OssStorage) {}
  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      if (!this.running && this.storage.support()) this.running = this.sweep().catch(() => this.log.error('Upload cleanup failed; retry scheduled'))
        .finally(() => { this.running = undefined; });
    }, 60000); this.timer.unref();
  }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.running; }
  async sweep() {
    const query = this.db.getRepository(UploadMedia).createQueryBuilder('v')
      .where('v.expiresAt < :before', { before: new Date(Date.now() - 60000) })
      .andWhere("(v.stagingCleanedAt IS NULL OR (v.status IN ('FAILED','DELETED') AND v.cleanedAt IS NULL))")
      .orderBy('v.expiresAt', 'ASC').addOrderBy('v.id', 'ASC').take(50);
    if (this.cursor) query.andWhere('(v.expiresAt > :cursorTime OR (v.expiresAt = :cursorTime AND v.id > :cursorId))',
      { cursorTime: this.cursor.expiresAt, cursorId: this.cursor.id });
    const rows = await query.getMany();
    for (const row of rows) {
      try { await this.uploads.cleanup(row.id); }
      catch { this.log.warn('Upload cleanup deferred; retry scheduled'); }
    }
    const last = rows.at(-1);
    this.cursor = rows.length === 50 && last ? { expiresAt: last.expiresAt, id: last.id } : undefined;
  }
}
