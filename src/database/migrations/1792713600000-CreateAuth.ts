import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuth1792713600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const sql = readFileSync(resolve(__dirname, '../../../database/schema.sql'), 'utf8');
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/).filter((part) => part.trim())) {
      await queryRunner.query(statement);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE refresh_tokens');
    await queryRunner.query('DROP TABLE auth_sessions');
    await queryRunner.query('DROP TABLE users');
  }
}
