import { Column, Entity, Index } from 'typeorm';
import { Versioned } from '../commerce/entities';

@Entity('user_memberships')
@Index('uq_user_membership', ['userId'], { unique: true })
export class UserMembership extends Versioned {
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'starts_at', type: 'datetime', precision: 3 }) startsAt!: Date;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt!: Date | null;
  @Column({ type: 'varchar', length: 500, select: false }) reason!: string;
  @Column({ name: 'operator_id', type: 'varchar', length: 36, select: false }) operatorId!: string;
}
