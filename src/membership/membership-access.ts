import { EntityManager } from 'typeorm';
import { User } from '../database/entities';
import { MembershipEntitlement, UserMembership } from './entities';

export interface MembershipSummary {
  active: boolean;
  expiresAt: string | null;
  benefitCodes: string[];
}

/** Reused by administrative search so filtering and protected-content access agree. */
export function activeMembershipSql(userAlias: string, nowParameter = 'membershipNow'): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(userAlias) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nowParameter)) {
    throw new Error('Invalid membership query identifier');
  }
  return `(${userAlias}.status = 'ACTIVE' AND (EXISTS (
    SELECT 1 FROM user_memberships membership_manual WHERE membership_manual.user_id = ${userAlias}.id
    AND membership_manual.revoked_at IS NULL AND membership_manual.starts_at <= :${nowParameter}
    AND membership_manual.expires_at > :${nowParameter}
  ) OR EXISTS (
    SELECT 1 FROM membership_entitlements membership_paid WHERE membership_paid.user_id = ${userAlias}.id
    AND membership_paid.status = 'ACTIVE' AND membership_paid.revoked_at IS NULL
    AND membership_paid.starts_at <= :${nowParameter} AND membership_paid.expires_at > :${nowParameter}
  )))`;
}

/** Always read current membership state; tokens never contain membership rights. */
export async function activeMembership(m: EntityManager, userId: string): Promise<UserMembership | MembershipEntitlement | null> {
  const now = new Date();
  const manual = await m.getRepository(UserMembership).createQueryBuilder('membership')
    .innerJoin(User, 'member_user', 'member_user.id = membership.userId AND member_user.status = :status', { status: 'ACTIVE' })
    .where('membership.userId = :userId', { userId })
    .andWhere('membership.revokedAt IS NULL')
    .andWhere('membership.startsAt <= :now AND membership.expiresAt > :now', { now })
    .getOne();
  if (manual) return manual;
  return m.getRepository(MembershipEntitlement).createQueryBuilder('membership')
    .innerJoin(User, 'member_user', 'member_user.id = membership.userId AND member_user.status = :status', { status: 'ACTIVE' })
    .where('membership.userId = :userId', { userId })
    .andWhere("membership.status = 'ACTIVE' AND membership.revokedAt IS NULL")
    .andWhere('membership.startsAt <= :now AND membership.expiresAt > :now', { now })
    .getOne();
}

export async function membershipSummary(m: EntityManager, userId: string): Promise<MembershipSummary> {
  const [manual, latestPaid, current] = await Promise.all([
    m.findOneBy(UserMembership, { userId }),
    m.getRepository(MembershipEntitlement).createQueryBuilder('p')
      .where("p.userId = :userId AND p.status = 'ACTIVE' AND p.revokedAt IS NULL", { userId })
      .orderBy('p.expiresAt', 'DESC').getOne(),
    activeMembership(m, userId),
  ]);
  const expiries = [manual && !manual.revokedAt ? manual.expiresAt : null, latestPaid?.expiresAt]
    .filter((d): d is Date => !!d);
  const expiresAt = expiries.length ? new Date(Math.max(...expiries.map(d => d.getTime()))).toISOString() : null;
  return { active: !!current, expiresAt, benefitCodes: current ? ['MEMBER_CONTENT'] : [] };
}

export async function summarizeMembership(m: EntityManager, record: UserMembership | null): Promise<MembershipSummary> {
  return record ? membershipSummary(m, record.userId) : { active: false, expiresAt: null, benefitCodes: [] };
}
