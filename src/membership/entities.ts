import { Column, Entity, Index } from 'typeorm';
import { RecordBase, Versioned } from '../commerce/entities';

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

export interface MembershipPlanSnapshot {
  planId: string;
  name: string;
  durationDays: number;
  priceCents: number;
  benefitCodes: string[];
}

@Entity('membership_plans')
export class MembershipPlan extends Versioned {
  @Column({ type: 'varchar', length: 64 }) name!: string;
  @Column({ type: 'varchar', length: 2000 }) description!: string;
  @Column({ name: 'duration_days', type: 'int', unsigned: true }) durationDays!: number;
  @Column({ name: 'price_cents', type: 'int', unsigned: true }) priceCents!: number;
  @Column({ name: 'benefit_codes', type: 'json' }) benefitCodes!: string[];
  @Column({ type: 'boolean', default: false }) enabled!: boolean;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder!: number;
}

export const MEMBERSHIP_PERIOD_STATUSES = ['ACTIVE', 'REFUND_PENDING', 'SUSPENDED', 'REVOKED'] as const;

@Entity('membership_entitlements')
@Index('uq_membership_entitlement_order', ['orderId'], { unique: true })
@Index('idx_membership_entitlement_access', ['userId', 'status', 'startsAt', 'expiresAt'])
export class MembershipEntitlement extends RecordBase {
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'plan_id', type: 'varchar', length: 36 }) planId!: string;
  @Column({ name: 'order_id', type: 'varchar', length: 36 }) orderId!: string;
  @Column({ type: 'json' }) snapshot!: MembershipPlanSnapshot;
  @Column({ name: 'starts_at', type: 'datetime', precision: 3 }) startsAt!: Date;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt!: Date;
  @Column({ type: 'varchar', length: 24 }) status!: typeof MEMBERSHIP_PERIOD_STATUSES[number];
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt!: Date | null;
}

export const membershipEntities = [UserMembership, MembershipPlan, MembershipEntitlement];
