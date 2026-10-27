import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { DataSource, EntityManager, In } from 'typeorm';
import { ApiException, Principal } from '../common/http';
import { PageDto } from '../auth/auth.dto';
import { Category, OrderItem, Quote } from '../commerce/entities';
import { CatalogService } from '../commerce/catalog.service';
import { Actor, CommerceTransaction, checkVersion, conflict, defined, missing, page, touch } from '../commerce/transaction';
import { BodyRecord, Chapter, ColumnContent, Content, ContentColumn, ContentKind, ContentMedia, CourseEntitlement, isCourse, isVideo } from './entities';
import * as D from './content.dto';
import { activeMembership } from '../membership/membership-access';
import { validateContentImageUrl } from './media-source';
import { lockManagedReference } from '../uploads/references';
import { contentCategoryScope } from './entities';
import { CONTENT_SCOPE_SQL } from '../commerce/category-scope';

export type Access = { canAccess: boolean; reason: 'FREE' | 'PURCHASED' | 'MEMBER' | 'PREVIEW' | 'ADMIN' | 'LOGIN_REQUIRED' | 'PURCHASE_REQUIRED' | 'MEMBERSHIP_REQUIRED' | 'CONTENT_UNAVAILABLE' };
const emptyBody = { bodyHtml: null, imageMediaIds: [] as string[], videoMediaId: null, publishedAt: null };
const invalid = (message: string): never => { throw new ApiException(400, 'VALIDATION_ERROR', message); };

@Injectable()
export class ContentService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction, private readonly catalog: CatalogService) {}
  async media(m: EntityManager, id: string, purpose: ContentMedia['purpose']) {
    const v = await m.findOneBy(ContentMedia, { id, purpose });
    if (!v) conflict('MEDIA_UNAVAILABLE', '素材不存在或用途不匹配');
    return v!;
  }
  mediaView(v: ContentMedia) { return { id: v.id, kind: v.kind, provider: v.provider, status: 'READY', mimeType: v.mimeType, sizeBytes: v.sizeBytes, publicUrl: v.publicUrl }; }
  // Only mutations take the upload row lock: it serializes attaching a file with deletion.
  private async boundMedia(m: EntityManager, id: string, purpose: ContentMedia['purpose']) {
    const media = await this.media(m, id, purpose);
    await lockManagedReference(m, id, purpose, media.publicUrl ?? undefined);
    return media;
  }
  private async newCover(m: EntityManager, id: string, purpose: 'CONTENT_COVER' | 'COLUMN_COVER') {
    const cover = await this.boundMedia(m, id, purpose);
    validateContentImageUrl(cover.publicUrl ?? '', true);
  }
  async lockContent(m: EntityManager, id: string) {
    const c = await m.findOne(Content, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!c) throw missing(); return c;
  }
  private async references(m: EntityManager, c: Content) {
    if (!await m.existsBy(Category, { id: c.categoryId, scope: contentCategoryScope(c.kind), enabled: true })) conflict('CATEGORY_UNAVAILABLE', isCourse(c.kind) ? '请选择启用的课程分类' : '请选择启用的科普分类');
    await this.boundMedia(m, c.coverMediaId, 'CONTENT_COVER');
    if ((!isCourse(c.kind) && c.accessPolicy !== 'FREE') || (c.accessPolicy === 'PURCHASE' ? c.priceCents <= 0 : c.priceCents !== 0)) invalid('科普必须免费；免费或会员课程价格为 0，购买课程价格须大于 0');
    if (c.accessPolicy === 'MEMBER' && await m.existsBy(OrderItem, { courseId: c.id })) conflict('RESOURCE_IN_USE', '已有购买订单的课程不能改为会员专享，请另建会员课程');
    if (c.videoMediaId) await this.validateVideoSource(m, c, null, c.videoMediaId);
    if (isVideo(c.kind) && isCourse(c.kind)) for (const ch of await m.findBy(Chapter, { courseId: c.id })) {
      if (ch.videoMediaId) await this.validateVideoSource(m, c, ch, ch.videoMediaId);
    }
  }
  async purchased(m: EntityManager, c: Content, principal?: Principal) {
    return !!principal && isCourse(c.kind) && await m.existsBy(CourseEntitlement, { userId: principal.user.id, courseId: c.id, status: 'ACTIVE' });
  }
  async access(m: EntityManager, c: Content, principal?: Principal, ch?: Chapter): Promise<Access> {
    const bought = await this.purchased(m, c, principal);
    const visible = c.status === 'PUBLISHED' && await m.existsBy(Category, { id: c.categoryId, scope: contentCategoryScope(c.kind), enabled: true });
    if ((!visible && !(bought && c.status !== 'DRAFT' && c.publishedAt)) || (ch && (ch.status === 'DRAFT' || (ch.status === 'OFFLINE' && !(bought && ch.publishedAt)))))
      return { canAccess: false, reason: 'CONTENT_UNAVAILABLE' };
    if (bought && c.accessPolicy !== 'MEMBER') return { canAccess: true, reason: 'PURCHASED' };
    if (c.accessPolicy === 'FREE') return { canAccess: true, reason: 'FREE' };
    if (c.accessPolicy === 'MEMBER' && principal && await activeMembership(m, principal.user.id)) return { canAccess: true, reason: 'MEMBER' };
    if (ch?.isPreview) return { canAccess: true, reason: 'PREVIEW' };
    return { canAccess: false, reason: principal ? c.accessPolicy === 'MEMBER' ? 'MEMBERSHIP_REQUIRED' : 'PURCHASE_REQUIRED' : 'LOGIN_REQUIRED' };
  }
  assertAccess(a: Access) {
    if (a.reason === 'CONTENT_UNAVAILABLE') throw missing();
    if (!a.canAccess) throw new ApiException(a.reason === 'LOGIN_REQUIRED' ? 401 : 403,
      a.reason === 'LOGIN_REQUIRED' ? 'AUTH_REQUIRED' : 'CONTENT_ACCESS_DENIED', '请登录并取得对应课程或会员访问资格');
  }
  private async validateVideoSource(m: EntityManager, c: Content, ch: Chapter | null, mediaId: string) {
    const media = await this.boundMedia(m, mediaId, 'CONTENT_VIDEO');
    this.validateProvider(c, ch, media.provider);
    return media;
  }
  private validateProvider(c: Content, ch: Chapter | null, provider: ContentMedia['provider']) {
    if (provider === 'BILIBILI' && c.kind !== 'SCIENCE_VIDEO') invalid('B站来源仅用于免费科普视频');
    if (provider === 'FEISHU' && (c.kind !== 'VIDEO_COURSE' || c.accessPolicy !== 'MEMBER' || !ch || ch.isPreview))
      invalid('飞书来源仅用于会员视频课程的非试看章节');
  }
  async assertExternalAccess(m: EntityManager, c: Content, ch: Chapter | null, p: Principal | undefined, provider: ContentMedia['provider']) {
    this.validateProvider(c, ch, provider);
    if (provider === 'FEISHU') {
      if (!p) throw new ApiException(401, 'AUTH_REQUIRED', '请登录后访问会员视频');
      if (!await activeMembership(m, p.user.id)) throw new ApiException(403, 'CONTENT_ACCESS_DENIED', '需要有效的网站会员资格');
    }
  }
  async view(m: EntityManager, c: Content, detail = false, admin = false, principal?: Principal) {
    const cover = await this.media(m, c.coverMediaId, 'CONTENT_COVER');
    const category = await m.findOneByOrFail(Category, { id: c.categoryId });
    const summary = { id: c.id, kind: c.kind, title: c.title, summary: c.summary, cover: this.mediaView(cover),
      category: this.catalog.categoryView(category), tags: c.tags, accessPolicy: c.accessPolicy, priceCents: c.priceCents,
      currency: 'CNY', chapterCount: isCourse(c.kind) ? await m.countBy(Chapter, { courseId: c.id, status: 'PUBLISHED' }) : 0, publishedAt: c.publishedAt };
    if (!detail && !admin) return summary;
    const links = await m.getRepository(ColumnContent).createQueryBuilder('l').innerJoin(ContentColumn, 'col', 'col.id = l.columnId')
      .where('l.contentId = :id', { id: c.id }).andWhere(admin ? '1=1' : "col.status = 'PUBLISHED'").orderBy('l.columnId', 'ASC').getMany();
    return { ...summary, descriptionHtml: c.descriptionHtml, authorName: c.authorName, columnIds: links.map(l => l.columnId),
      access: admin ? { canAccess: true, reason: 'ADMIN' } : await this.access(m, c, principal),
      ...(admin ? { status: c.status, version: c.version, createdAt: c.createdAt, updatedAt: c.updatedAt } : {}) };
  }
  async list(q: D.AdminContentQueryDto, kinds?: ContentKind[], admin = false, columnId?: string) {
    columnId ??= q.columnId;
    return this.db.transaction('REPEATABLE READ', async m => {
      const b = m.getRepository(Content).createQueryBuilder('c');
      if (columnId) {
        await this.getColumn(m, columnId, admin);
        b.innerJoin(ColumnContent, 'link', 'link.contentId = c.id AND link.columnId = :columnId', { columnId }).addSelect(['link.id', 'link.sortOrder']);
      }
      if (!admin) b.innerJoin(Category, 'category', `category.id = c.categoryId AND category.enabled = true AND category.scope = ${CONTENT_SCOPE_SQL}`).andWhere("c.status = 'PUBLISHED'");
      if (admin && q.status) b.andWhere('c.status = :status', { status: q.status });
      if (kinds) b.andWhere('c.kind IN (:...kinds)', { kinds });
      for (const field of ['kind', 'categoryId', 'accessPolicy'] as const) if (q[field]) b.andWhere(`c.${field} = :${field}`, { [field]: q[field] });
      if (q.keyword) b.andWhere("(c.title LIKE :word OR c.summary LIKE :word OR JSON_SEARCH(c.tags, 'one', :word) IS NOT NULL)", { word: `%${q.keyword}%` });
      if (q.tag) b.andWhere('JSON_CONTAINS(c.tags, :tag)', { tag: JSON.stringify(q.tag) });
      if (columnId) b.orderBy('link.sortOrder', 'ASC').addOrderBy('link.id', 'ASC');
      else if (q.sort?.startsWith('priceCents')) b.orderBy('c.priceCents', q.sort.endsWith('asc') ? 'ASC' : 'DESC');
      else b.orderBy(admin || q.sort?.startsWith('createdAt') ? 'c.createdAt' : 'c.publishedAt', q.sort?.endsWith(':asc') ? 'ASC' : 'DESC');
      const [items, total] = await b.addOrderBy('c.id', 'DESC').skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
      return page(await Promise.all(items.map(c => this.view(m, c, admin, admin))), total, q);
    });
  }
  async get(id: string, kinds?: ContentKind[], principal?: Principal, admin = false) {
    return this.db.transaction('REPEATABLE READ', async m => {
      const c = await m.findOneBy(Content, { id });
      if (!c || (kinds && !kinds.includes(c.kind))) throw missing();
      if (!admin && (await this.access(m, c, principal)).reason === 'CONTENT_UNAVAILABLE') throw missing();
      return this.view(m, c, true, admin, principal);
    });
  }
  create(actor: Actor, dto: D.ContentCreateDto) {
    return this.tx.run(actor, async m => {
      const c = m.create(Content, { id: randomUUID(), ...dto, descriptionHtml: this.catalog.clean(dto.descriptionHtml ?? ''),
        authorName: dto.authorName ?? '', tags: dto.tags ?? [], ...emptyBody, status: 'DRAFT', version: 1 });
      await this.newCover(m, c.coverMediaId, 'CONTENT_COVER');
      await this.references(m, c); await m.save(c); await this.tx.audit(m, actor, 'content.create', c.id);
      return this.view(m, c, true, true);
    });
  }
  patch(actor: Actor, id: string, dto: D.ContentPatchDto) {
    return this.tx.run(actor, async m => {
      const c = await this.lockContent(m, id); checkVersion(c, dto.version);
      if (Object.keys(defined(dto)).length < 2) invalid('请提供修改字段');
      if ((dto.accessPolicy === undefined) !== (dto.priceCents === undefined)) invalid('accessPolicy 和 priceCents 须同时提交');
      if (dto.coverMediaId !== undefined && dto.coverMediaId !== c.coverMediaId) await this.newCover(m, dto.coverMediaId, 'CONTENT_COVER');
      Object.assign(c, defined(dto)); c.descriptionHtml = this.catalog.clean(c.descriptionHtml);
      await this.references(m, c); touch(c); await m.save(c); await this.tx.audit(m, actor, 'content.update', id);
      return this.view(m, c, true, true);
    });
  }
  private async bodyReady(m: EntityManager, record: BodyRecord, video: boolean) {
    if (video) { if (!record.videoMediaId) conflict('CONTENT_NOT_READY', '请先配置视频'); await this.boundMedia(m, record.videoMediaId!, 'CONTENT_VIDEO'); }
    else {
      if (!record.bodyHtml?.trim()) conflict('CONTENT_NOT_READY', '请先填写正文');
      for (const id of [...record.imageMediaIds].sort()) await this.boundMedia(m, id, 'CONTENT_BODY_IMAGE');
    }
  }
  publish(actor: Actor, id: string, version: number, status: 'PUBLISHED' | 'OFFLINE') {
    return this.tx.run(actor, async m => {
      const c = await this.lockContent(m, id); checkVersion(c, version);
      if (status === 'PUBLISHED') {
        await this.references(m, c);
        if (isCourse(c.kind)) {
          if (!await m.existsBy(Chapter, { courseId: id, status: 'PUBLISHED' })) conflict('CONTENT_NOT_READY', '课程至少需要一章已发布章节');
        } else await this.bodyReady(m, c, isVideo(c.kind));
        c.publishedAt ??= new Date();
      } else if (c.status !== 'PUBLISHED') conflict('CONTENT_STATE_INVALID', '只能下架已发布内容');
      c.status = status; touch(c); await m.save(c); await this.tx.audit(m, actor, `content.${status.toLowerCase()}`, id);
      return this.view(m, c, true, true);
    });
  }
  delete(actor: Actor, id: string, version: number) {
    return this.tx.run(actor, async m => {
      const c = await this.lockContent(m, id); checkVersion(c, version);
      if (c.status !== 'DRAFT' || c.publishedAt || await m.existsBy(Chapter, { courseId: id }) || await m.existsBy(OrderItem, { courseId: id }) || await m.existsBy(ColumnContent, { contentId: id }))
        conflict('RESOURCE_IN_USE', '仅可删除无章节、专栏或交易引用且从未发布的草稿');
      if (await m.getRepository(Quote).createQueryBuilder('q').where("JSON_SEARCH(q.items, 'one', :id, NULL, '$[*].resourceId') IS NOT NULL", { id }).getExists()) conflict('RESOURCE_IN_USE', '存在历史报价');
      await m.delete(Content, id); await this.tx.audit(m, actor, 'content.delete', id); return { success: true };
    });
  }
  async lockChapter(m: EntityManager, id: string) {
    const candidate = await m.findOneBy(Chapter, { id }); if (!candidate) throw missing();
    const c = await this.lockContent(m, candidate.courseId);
    const ch = await m.findOne(Chapter, { where: { id }, lock: { mode: 'pessimistic_write' } }); if (!ch) throw missing();
    return { c, ch };
  }
  bodyView(r: BodyRecord) { return { bodyHtml: r.bodyHtml, imageMediaIds: r.imageMediaIds, videoMediaId: r.videoMediaId, version: r.version }; }
  async adminBody(id: string, chapter: boolean) {
    const r = chapter ? await this.db.manager.findOneBy(Chapter, { id }) : await this.db.manager.findOneBy(Content, { id });
    if (!r || (r instanceof Content && isCourse(r.kind))) throw missing(); return this.bodyView(r);
  }
  saveBody(actor: Actor, id: string, dto: D.BodyDto, chapter: boolean) {
    return this.tx.run(actor, async m => {
      const { c, ch } = chapter ? await this.lockChapter(m, id) : { c: await this.lockContent(m, id), ch: null };
      if (!chapter && isCourse(c.kind)) invalid('课程请通过章节接口设置正文');
      const r = ch ?? c; checkVersion(r, dto.version);
      if (isVideo(c.kind)) {
        if (!dto.videoMediaId || dto.bodyHtml !== undefined || dto.imageMediaIds !== undefined) invalid('视频只能提交 videoMediaId');
        await this.validateVideoSource(m, c, ch, dto.videoMediaId!);
        r.videoMediaId = dto.videoMediaId!; r.bodyHtml = null; r.imageMediaIds = [];
      } else {
        if (dto.bodyHtml === undefined || dto.imageMediaIds === undefined || dto.videoMediaId !== undefined) invalid('图文须提交 bodyHtml 和 imageMediaIds');
        const urls = new Set<string>();
        for (const mediaId of [...dto.imageMediaIds!].sort()) urls.add((await this.boundMedia(m, mediaId, 'CONTENT_BODY_IMAGE')).publicUrl!);
        r.bodyHtml = sanitizeHtml(dto.bodyHtml!, { allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'img'],
          allowedAttributes: { img: ['src', 'alt'] }, allowedSchemes: ['https'],
          transformTags: { img: (_tag, attrs) => { if (!urls.has(attrs.src)) invalid('正文图片必须引用登记的 imageMediaIds'); return { tagName: 'img', attribs: { src: attrs.src, alt: attrs.alt ?? '' } }; } } });
        if (!r.bodyHtml.trim()) invalid('清洗后的正文不能为空');
        r.imageMediaIds = dto.imageMediaIds!; r.videoMediaId = null;
      }
      touch(r); await m.save(r); await this.tx.audit(m, actor, chapter ? 'chapter.body' : 'content.body', id); return this.bodyView(r);
    });
  }
  async chapterView(m: EntityManager, c: Content, ch: Chapter, admin = false, p?: Principal) {
    const durationSeconds = ch.videoMediaId ? (await this.media(m, ch.videoMediaId, 'CONTENT_VIDEO')).durationSeconds : 0;
    return { id: ch.id, courseId: c.id, title: ch.title, kind: ch.kind, sortOrder: ch.sortOrder, isPreview: ch.isPreview, durationSeconds,
      access: admin ? { canAccess: true, reason: 'ADMIN' } : await this.access(m, c, p, ch),
      ...(admin ? { status: ch.status, version: ch.version, createdAt: ch.createdAt, updatedAt: ch.updatedAt } : {}) };
  }
  async chapters(id: string, q: D.ChapterQueryDto, p?: Principal, admin = false) {
    return this.db.transaction('REPEATABLE READ', async m => {
      const c = await m.findOneBy(Content, { id }); if (!c || !isCourse(c.kind)) throw missing();
      if (!admin && (await this.access(m, c, p)).reason === 'CONTENT_UNAVAILABLE') throw missing();
      const states = await this.purchased(m, c, p) ? ['PUBLISHED', 'OFFLINE'] : ['PUBLISHED'];
      const b = m.getRepository(Chapter).createQueryBuilder('ch').where('ch.courseId = :id', { id });
      if (admin && q.status) b.andWhere('ch.status = :status', { status: q.status });
      if (!admin) b.andWhere('ch.status IN (:...states)', { states }).andWhere('ch.publishedAt IS NOT NULL');
      const [items, total] = await b.orderBy('ch.sortOrder', 'ASC').addOrderBy('ch.id', 'ASC').skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
      return page(await Promise.all(items.map(ch => this.chapterView(m, c, ch, admin, p))), total, q);
    });
  }
  createChapter(actor: Actor, courseId: string, dto: D.ChapterCreateDto) {
    return this.tx.run(actor, async m => {
      const c = await this.lockContent(m, courseId); if (!isCourse(c.kind)) throw missing();
      const ch = m.create(Chapter, { id: randomUUID(), courseId, ...dto, kind: isVideo(c.kind) ? 'VIDEO' : 'ARTICLE', isPreview: dto.isPreview ?? false, ...emptyBody, status: 'DRAFT', version: 1 });
      await m.save(ch); await this.tx.audit(m, actor, 'chapter.create', ch.id); return this.chapterView(m, c, ch, true);
    });
  }
  async chapter(id: string) {
    const ch = await this.db.manager.findOneBy(Chapter, { id }); if (!ch) throw missing();
    return this.chapterView(this.db.manager, await this.db.manager.findOneByOrFail(Content, { id: ch.courseId }), ch, true);
  }
  patchChapter(actor: Actor, id: string, dto: D.ChapterPatchDto) {
    return this.tx.run(actor, async m => {
      const { c, ch } = await this.lockChapter(m, id); checkVersion(ch, dto.version);
      if (Object.keys(defined(dto)).length < 2) invalid('请提供修改字段');
      Object.assign(ch, defined(dto));
      if (ch.videoMediaId) await this.validateVideoSource(m, c, ch, ch.videoMediaId);
      touch(ch); await m.save(ch); await this.tx.audit(m, actor, 'chapter.update', id); return this.chapterView(m, c, ch, true);
    });
  }
  publishChapter(actor: Actor, id: string, version: number, status: 'PUBLISHED' | 'OFFLINE') {
    return this.tx.run(actor, async m => {
      const { c, ch } = await this.lockChapter(m, id); checkVersion(ch, version);
      if (status === 'PUBLISHED') {
        if (ch.videoMediaId) await this.validateVideoSource(m, c, ch, ch.videoMediaId);
        await this.bodyReady(m, ch, isVideo(c.kind)); ch.publishedAt ??= new Date();
      }
      else if (ch.status !== 'PUBLISHED') conflict('CONTENT_STATE_INVALID', '只能下架已发布章节');
      ch.status = status; touch(ch); await m.save(ch);
      if (status === 'OFFLINE' && c.status === 'PUBLISHED' && !await m.existsBy(Chapter, { courseId: c.id, status: 'PUBLISHED' })) {
        c.status = 'OFFLINE'; touch(c); await m.save(c); await this.tx.audit(m, actor, 'content.auto-offline', c.id, { chapterId: id });
      }
      await this.tx.audit(m, actor, `chapter.${status.toLowerCase()}`, id); return this.chapterView(m, c, ch, true);
    });
  }
  deleteChapter(actor: Actor, id: string, version: number) {
    return this.tx.run(actor, async m => {
      const { c, ch } = await this.lockChapter(m, id); checkVersion(ch, version);
      if (ch.status !== 'DRAFT' || ch.publishedAt || await m.existsBy(CourseEntitlement, { courseId: c.id })) conflict('RESOURCE_IN_USE', '已发布或已购买课程的章节只能下架');
      await m.delete(Chapter, id); await this.tx.audit(m, actor, 'chapter.delete', id); return { success: true };
    });
  }
  async readable(m: EntityManager, id: string, chapter: boolean, video: boolean, p?: Principal, admin = false) {
    const ch = chapter ? await m.findOneBy(Chapter, { id }) : null;
    const c = await m.findOneBy(Content, { id: chapter ? ch?.courseId ?? '' : id });
    if (!c || (chapter && !ch) || (!chapter && isCourse(c.kind)) || isVideo(c.kind) !== video) throw missing();
    const access: Access = admin ? { canAccess: true, reason: 'ADMIN' } : await this.access(m, c, p, ch ?? undefined);
    this.assertAccess(access);
    return { c, ch, record: ch ?? c, access };
  }
  async body(id: string, chapter: boolean, p?: Principal) {
    return this.db.transaction('REPEATABLE READ', async m => {
      const { c, record } = await this.readable(m, id, chapter, false, p);
      return { contentId: c.id, bodyHtml: record.bodyHtml, imageUrls: await Promise.all(record.imageMediaIds.map(async mid => (await this.media(m, mid, 'CONTENT_BODY_IMAGE')).publicUrl!)) };
    });
  }
  async purchasedCourses(userId: string, q: D.PurchasedQueryDto) {
    return this.db.transaction('REPEATABLE READ', async m => {
      const [rows, total] = await m.findAndCount(CourseEntitlement, { where: { userId, ...(q.status ? { status: q.status } : {}) }, order: { createdAt: 'DESC', id: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
      return page(await Promise.all(rows.map(async e => ({ id: e.id, course: await this.view(m, await m.findOneByOrFail(Content, { id: e.courseId })), orderId: e.orderId, status: e.status, grantedAt: e.createdAt }))), total, q);
    });
  }
  private async getColumn(m: EntityManager, id: string, admin: boolean, lock = false) {
    const col = await m.findOne(ContentColumn, { where: { id }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!col || (!admin && col.status !== 'PUBLISHED')) throw missing(); return col;
  }
  async columnView(m: EntityManager, col: ContentColumn, admin: boolean) {
    const contentCount = await m.getRepository(ColumnContent).createQueryBuilder('l')
      .innerJoin(Content, 'c', "c.id = l.contentId AND c.status = 'PUBLISHED'")
      .innerJoin(Category, 'cat', 'cat.id = c.categoryId AND cat.enabled = true').where('l.columnId = :id', { id: col.id }).getCount();
    return { id: col.id, name: col.name, description: col.description, cover: this.mediaView(await this.media(m, col.coverMediaId, 'COLUMN_COVER')), contentCount, sortOrder: col.sortOrder,
      ...(admin ? { status: col.status, version: col.version, createdAt: col.createdAt, updatedAt: col.updatedAt } : {}) };
  }
  async columns(q: D.AdminColumnQueryDto, admin = false) {
    return this.db.transaction('REPEATABLE READ', async m => {
      const b = m.getRepository(ContentColumn).createQueryBuilder('c');
      if (!admin) b.andWhere("c.status = 'PUBLISHED'");
      if (admin && q.status) b.andWhere('c.status = :status', { status: q.status });
      if (q.keyword) b.andWhere('c.name LIKE :word', { word: `%${q.keyword}%` });
      const [items, total] = await b.orderBy('c.sortOrder', 'ASC').addOrderBy('c.id', 'ASC').skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
      return page(await Promise.all(items.map(c => this.columnView(m, c, admin))), total, q);
    });
  }
  async column(id: string, admin = false) { return this.db.transaction('REPEATABLE READ', async m => this.columnView(m, await this.getColumn(m, id, admin), admin)); }
  saveColumn(actor: Actor, dto: D.ColumnCreateDto | D.ColumnPatchDto, id?: string) {
    return this.tx.run(actor, async m => {
      const col = id ? await this.getColumn(m, id, true, true) : m.create(ContentColumn, { id: randomUUID(), description: '', sortOrder: 0, status: 'DRAFT', version: 1 });
      if (id) { checkVersion(col, (dto as D.ColumnPatchDto).version); if (Object.keys(defined(dto)).length < 2) invalid('请提供修改字段'); }
      if (!id || (dto.coverMediaId !== undefined && dto.coverMediaId !== col.coverMediaId)) await this.newCover(m, dto.coverMediaId!, 'COLUMN_COVER');
      Object.assign(col, defined(dto)); await this.boundMedia(m, col.coverMediaId, 'COLUMN_COVER'); if (id) touch(col);
      await m.save(col); await this.tx.audit(m, actor, id ? 'column.update' : 'column.create', col.id); return this.columnView(m, col, true);
    });
  }
  publishColumn(actor: Actor, id: string, version: number, status: 'PUBLISHED' | 'OFFLINE') {
    return this.tx.run(actor, async m => {
      const col = await this.getColumn(m, id, true, true); checkVersion(col, version);
      if (status === 'OFFLINE' && col.status !== 'PUBLISHED') conflict('CONTENT_STATE_INVALID', '只能下架已发布专栏');
      await this.boundMedia(m, col.coverMediaId, 'COLUMN_COVER'); col.status = status; touch(col); await m.save(col);
      await this.tx.audit(m, actor, `column.${status.toLowerCase()}`, id); return this.columnView(m, col, true);
    });
  }
  deleteColumn(actor: Actor, id: string, version: number) {
    return this.tx.run(actor, async m => {
      const col = await this.getColumn(m, id, true, true); checkVersion(col, version);
      if (col.status === 'PUBLISHED') conflict('RESOURCE_IN_USE', '请先下架专栏');
      await m.delete(ColumnContent, { columnId: id }); await m.delete(ContentColumn, id); await this.tx.audit(m, actor, 'column.delete', id); return { success: true };
    });
  }
  link(actor: Actor, columnId: string, contentId: string, dto?: D.ColumnLinkDto) {
    return this.tx.run(actor, async m => {
      // Content before column everywhere, including deletion, to serialize visibility changes.
      await this.lockContent(m, contentId); const col = await this.getColumn(m, columnId, true, true);
      const old = await m.findOneBy(ColumnContent, { columnId, contentId });
      if (dto) await m.save(m.create(ColumnContent, { id: old?.id ?? randomUUID(), columnId, contentId, sortOrder: dto.sortOrder }));
      else if (old) await m.delete(ColumnContent, old.id);
      if ((dto && (!old || old.sortOrder !== dto.sortOrder)) || (!dto && old)) { touch(col); await m.save(col); }
      await this.tx.audit(m, actor, dto ? 'column.link' : 'column.unlink', columnId, { contentId }); return { success: true };
    });
  }
}
