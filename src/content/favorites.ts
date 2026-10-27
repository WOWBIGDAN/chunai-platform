import { Body, Controller, Delete, Get, Injectable, Param, ParseUUIDPipe, PipeTransform, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import { PageDto } from '../auth/auth.dto';
import { ApiException, ApiRequest, Principal } from '../common/http';
import { Optional } from '../commerce/commerce.dto';
import { Category } from '../commerce/entities';
import { Actor, actorId, CommerceTransaction, conflict, missing, page } from '../commerce/transaction';
import { Content, ContentFavorite, ContentKind, CONTENT_KINDS, contentCategoryScope } from './entities';
import { CONTENT_SCOPE_SQL } from '../commerce/category-scope';
import { ContentService } from './content.service';

export class FavoriteQueryDto extends PageDto {
  @Optional() @IsIn(CONTENT_KINDS) kind?: ContentKind;
  @Optional() @IsIn(['VALID', 'INVALID']) status?: 'VALID' | 'INVALID';
}
class EmptyFavoriteBody implements PipeTransform {
  transform(value: unknown) {
    if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length))
      throw new ApiException(400, 'VALIDATION_ERROR', '此接口不接受请求字段');
    return value;
  }
}
@Injectable()
export class FavoritesService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction, private readonly content: ContentService) {}

  private async view(m: EntityManager, f: ContentFavorite, principal: Principal) {
    const content = await m.findOneByOrFail(Content, { id: f.contentId });
    const category = await m.findOneBy(Category, { id: content.categoryId });
    const invalidReason = content.status !== 'PUBLISHED' ? 'CONTENT_UNAVAILABLE' :
      !category?.enabled || category.scope !== contentCategoryScope(content.kind) ? 'CATEGORY_UNAVAILABLE' : null;
    return { id: f.id, contentId: f.contentId, createdAt: f.createdAt, valid: invalidReason === null, invalidReason,
      content: invalidReason ? null : await this.content.view(m, content),
      access: invalidReason ? { canAccess: false, reason: 'CONTENT_UNAVAILABLE' } : await this.content.access(m, content, principal) };
  }
  list(principal: Principal, q: FavoriteQueryDto) {
    return this.db.transaction('REPEATABLE READ', async m => {
      const b = m.getRepository(ContentFavorite).createQueryBuilder('f')
        .innerJoin(Content, 'c', 'c.id = f.contentId').innerJoin(Category, 'cat', 'cat.id = c.categoryId')
        .where('f.userId = :userId', { userId: principal.user.id });
      const valid = `c.status = 'PUBLISHED' AND cat.enabled = true AND cat.scope = ${CONTENT_SCOPE_SQL}`;
      if (q.kind) b.andWhere('c.kind = :kind', { kind: q.kind });
      if (q.status) b.andWhere(q.status === 'VALID' ? `(${valid})` : `NOT (${valid})`);
      const [items, total] = await b.orderBy('f.createdAt', 'DESC').addOrderBy('f.id', 'DESC')
        .skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
      return page(await Promise.all(items.map(f => this.view(m, f, principal))), total, q);
    });
  }
  state(principal: Principal, contentId: string) {
    return this.db.transaction('REPEATABLE READ', async m => {
      const f = await m.findOneBy(ContentFavorite, { userId: principal.user.id, contentId });
      return { contentId, favorited: !!f, favorite: f ? await this.view(m, f, principal) : null };
    });
  }
  put(actor: Actor & { kind: 'user' }, contentId: string) {
    return this.tx.run(actor, async m => {
      const userId = actorId(actor);
      const c = await this.content.lockContent(m, contentId);
      const existing = await m.findOneBy(ContentFavorite, { userId, contentId });
      // Retrying an existing favorite never turns an offline resource into accessible content.
      if (existing) return this.view(m, existing, actor.principal);
      const category = await m.findOne(Category, { where: { id: c.categoryId }, lock: { mode: 'pessimistic_read' } });
      if (c.status !== 'PUBLISHED' || !category?.enabled || category.scope !== contentCategoryScope(c.kind)) throw missing();
      if (await m.countBy(ContentFavorite, { userId }) >= 1000) conflict('FAVORITE_LIMIT', '最多保存 1000 条收藏');
      const f = m.create(ContentFavorite, { id: randomUUID(), userId, contentId });
      await m.save(f); return this.view(m, f, actor.principal);
    });
  }
  remove(actor: Actor, contentId: string) {
    return this.tx.run(actor, async m => {
      await m.delete(ContentFavorite, { userId: actorId(actor), contentId });
      return { success: true };
    });
  }
}
const uuid = new ParseUUIDPipe({ version: '4' });
const actor = (r: ApiRequest): Actor & { kind: 'user' } => ({ kind: 'user', principal: r.principal! });
@Controller('me/favorites')
@UseGuards(AuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}
  @Get() list(@Req() r: ApiRequest, @Query() q: FavoriteQueryDto) { return this.favorites.list(r.principal!, q); }
  @Get(':contentId') state(@Req() r: ApiRequest, @Param('contentId', uuid) id: string) { return this.favorites.state(r.principal!, id); }
  @Put(':contentId') put(@Req() r: ApiRequest, @Param('contentId', uuid) id: string, @Body(new EmptyFavoriteBody()) _body: unknown) { return this.favorites.put(actor(r), id); }
  @Delete(':contentId') remove(@Req() r: ApiRequest, @Param('contentId', uuid) id: string) { return this.favorites.remove(actor(r), id); }
}
