import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../common/http';
import { Actor, CommerceTransaction, checkVersion, defined, missing, page, touch } from '../commerce/transaction';
import { MembershipPlan } from './entities';
import { AdminMembershipPlanQueryDto, MembershipPlanCreateDto, MembershipPlanPatchDto, MembershipPlanQueryDto } from './membership.dto';

@Injectable()
export class MembershipPlansService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction) {}

  private async listing(m: EntityManager, query: MembershipPlanQueryDto | AdminMembershipPlanQueryDto, admin: boolean) {
    const q = m.getRepository(MembershipPlan).createQueryBuilder('p');
    if (!admin) q.andWhere('p.enabled = true');
    else if ((query as AdminMembershipPlanQueryDto).enabled !== undefined) {
      q.andWhere('p.enabled = :enabled', { enabled: (query as AdminMembershipPlanQueryDto).enabled });
    }
    if (query.keyword) q.andWhere('LOCATE(:keyword, p.name) > 0', { keyword: query.keyword.trim() });
    const [items, total] = await q.orderBy('p.sortOrder', 'ASC').addOrderBy('p.createdAt', 'DESC').addOrderBy('p.id', 'ASC')
      .skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount();
    return page(items, total, query);
  }

  private async detail(m: EntityManager, id: string, admin: boolean) {
    const plan = await m.findOneBy(MembershipPlan, admin ? { id } : { id, enabled: true });
    if (!plan) throw missing();
    return plan;
  }

  list(query: MembershipPlanQueryDto) { return this.listing(this.db.manager, query, false); }
  get(id: string) { return this.detail(this.db.manager, id, false); }
  adminList(actor: Actor, query: AdminMembershipPlanQueryDto) {
    return this.tx.run(actor, m => this.listing(m, query, true));
  }
  adminGet(actor: Actor, id: string) { return this.tx.run(actor, m => this.detail(m, id, true)); }

  create(actor: Actor, dto: MembershipPlanCreateDto) {
    return this.tx.run(actor, async m => {
      const plan = m.create(MembershipPlan, { ...dto, id: randomUUID(), name: dto.name.trim(), description: dto.description.trim(),
        benefitCodes: dto.benefitCodes ?? ['MEMBER_CONTENT'], enabled: false, sortOrder: dto.sortOrder ?? 0, version: 1 });
      await m.save(plan);
      await this.tx.audit(m, actor, 'membership-plan.create', plan.id, { name: plan.name, durationDays: plan.durationDays, priceCents: plan.priceCents });
      return plan;
    });
  }

  patch(actor: Actor, id: string, dto: MembershipPlanPatchDto) {
    const { version, ...values } = dto;
    const updates = defined(values);
    if (!Object.keys(updates).length) throw new ApiException(400, 'VALIDATION_ERROR', '请提供需要修改的套餐字段');
    return this.tx.run(actor, async m => {
      const plan = await m.findOne(MembershipPlan, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!plan) throw missing();
      checkVersion(plan, version);
      Object.assign(plan, updates);
      plan.name = plan.name.trim(); plan.description = plan.description.trim(); touch(plan);
      await m.save(plan);
      await this.tx.audit(m, actor, 'membership-plan.update', id, { version: plan.version, changedFields: Object.keys(updates), enabled: plan.enabled });
      return plan;
    });
  }
}
