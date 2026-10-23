import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly db: DataSource) {}

  @Get()
  async health() {
    await this.db.query('SELECT 1');
    return { status: 'ok' };
  }
}
