import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { integerEnv } from '../config';
import { AuthSession, RefreshToken, User } from './entities';
import { CreateAuth1792713600000 } from './migrations/1792713600000-CreateAuth';
import { CreateCommerce1792800000000 } from './migrations/1792800000000-CreateCommerce';
import { commerceEntities } from '../commerce/entities';
import { contentEntities } from '../content/entities';
import { membershipEntities } from '../membership/entities';
import { MembershipPurchasesUsers1793059200000 } from './migrations/1793059200000-MembershipPurchasesUsers';
import { ExternalMediaMembership1792972800000 } from './migrations/1792972800000-ExternalMediaMembership';
import { CreateContent1792886400000 } from './migrations/1792886400000-CreateContent';
import { uploadEntities } from '../uploads/entities';
import { UnifiedUploads1793145600000 } from './migrations/1793145600000-UnifiedUploads';

export function databaseOptions(): DataSourceOptions {
  if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required');
  const database = process.env.DB_NAME ?? 'chunai_platform';
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('Invalid DB_NAME');
  return {
    type: 'mysql',
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: integerEnv('DB_PORT', 3306, 1, 65535),
    username: process.env.DB_USER ?? 'chunai',
    password: process.env.DB_PASSWORD,
    database,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    entities: [User, AuthSession, RefreshToken, ...membershipEntities, ...commerceEntities, ...contentEntities, ...uploadEntities],
    migrations: [CreateAuth1792713600000, CreateCommerce1792800000000, CreateContent1792886400000, ExternalMediaMembership1792972800000, MembershipPurchasesUsers1793059200000, UnifiedUploads1793145600000],
    migrationsTableName: 'schema_migrations',
    synchronize: false,
    migrationsRun: false,
    // MySQL DDL implicitly commits; do not promise transactional migrations.
    migrationsTransactionMode: 'none',
    logging: false,
    extra: { connectionLimit: 10, multipleStatements: false },
  };
}

export default new DataSource(databaseOptions());
