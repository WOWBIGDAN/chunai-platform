import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommerce1792800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const sql = readFileSync(resolve(__dirname, '../../../database/commerce.sql'), 'utf8');
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/).filter(part => part.trim())) await queryRunner.query(statement);
  }
  async down(): Promise<void> {
    throw new Error('Commerce contains orders and financial history. Restore an approved database backup instead of dropping business tables.');
  }
}
