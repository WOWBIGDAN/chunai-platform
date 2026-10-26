import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type UserStatus = 'ACTIVE' | 'BANNED' | 'DEACTIVATED';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id!: string;
  @Column({ type: 'varchar', length: 16, unique: true }) phone!: string;
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false }) passwordHash!: string;
  @Column({ type: 'varchar', length: 32 }) nickname!: string;
  @Column({ name: 'avatar_url', type: 'varchar', length: 2048, nullable: true }) avatarUrl!: string | null;
  @Column({ type: 'int', unsigned: true, default: 1 }) version!: number;
  @Column({ type: 'enum', enum: ['ACTIVE', 'BANNED', 'DEACTIVATED'], default: 'ACTIVE' }) status!: UserStatus;
  @Column({ name: 'banned_reason', type: 'varchar', length: 500, nullable: true, select: false }) bannedReason!: string | null;
  @Column({ name: 'banned_at', type: 'datetime', precision: 3, nullable: true, select: false }) bannedAt!: Date | null;
  @Column({ name: 'phone_verified_at', type: 'datetime', precision: 3, nullable: true }) phoneVerifiedAt!: Date | null;
  @Column({ name: 'terms_version', type: 'varchar', length: 64 }) termsVersion!: string;
  @Column({ name: 'privacy_version', type: 'varchar', length: 64 }) privacyVersion!: string;
  @Column({ name: 'consented_at', type: 'datetime', precision: 3 }) consentedAt!: Date;
  @Column({ name: 'password_changed_at', type: 'datetime', precision: 3, nullable: true }) passwordChangedAt!: Date | null;
  @Column({ name: 'last_login_at', type: 'datetime', precision: 3, nullable: true }) lastLoginAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3, default: () => '(UTC_TIMESTAMP(3))' }) createdAt!: Date;
  // Set explicitly on mutations: MySQL CURRENT_TIMESTAMP follows the server time zone.
  @Column({ name: 'updated_at', type: 'datetime', precision: 3, default: () => '(UTC_TIMESTAMP(3))' }) updatedAt!: Date;
}

@Entity('auth_sessions')
export class AuthSession {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id!: string;
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'device_label', type: 'varchar', length: 255 }) deviceLabel!: string;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt!: Date | null;
  @Column({ name: 'last_active_at', type: 'datetime', precision: 3 }) lastActiveAt!: Date;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3, default: () => '(UTC_TIMESTAMP(3))' }) createdAt!: Date;
}

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id!: string;
  @Column({ name: 'session_id', type: 'varchar', length: 36 }) sessionId!: string;
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true, select: false }) tokenHash!: string;
  @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true }) usedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3, default: () => '(UTC_TIMESTAMP(3))' }) createdAt!: Date;
}
