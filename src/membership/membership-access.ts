import { EntityManager } from 'typeorm';
import { User } from '../database/entities';
import { UserMembership } from './entities';

export interface MembershipSummary {
  active: boolean;
  expiresAt: string | null;
  benefitCodes: string[];
}

/** Always read current membership state; tokens never contain membership rights. */
export async function activeMembership(m: EntityManager, userId: string): Promise<UserMembership | null> {
  const now = new Date();
  return m.getRepository(UserMembership).createQueryBuilder('membership')
    .innerJoin(User, 'member_user', 'member_user.id = membership.userId AND member_user.status = :status', { status: 'ACTIVE' })
    .where('membership.userId = :userId', { userId })
    .andWhere('membership.revokedAt IS NULL')
    .andWhere('membership.startsAt <= :now AND membership.expiresAt > :now', { now })
    .getOne();
}

export async function membershipSummary(m: EntityManager, userId: string): Promise<MembershipSummary> {
  const record = await m.findOneBy(UserMembership, { userId });
  return summarizeMembership(m, record);
}

export async function summarizeMembership(m: EntityManager, record: UserMembership | null): Promise<MembershipSummary> {
  const now = Date.now();
  const withinTerm = !!record && !record.revokedAt && record.startsAt.getTime() <= now && record.expiresAt.getTime() > now;
  const active = withinTerm && await m.existsBy(User, { id: record!.userId, status: 'ACTIVE' });
  return { active, expiresAt: record?.expiresAt.toISOString() ?? null, benefitCodes: active ? ['MEMBER_CONTENT'] : [] };
}
