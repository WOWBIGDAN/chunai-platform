import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { DataSource, EntityManager, In } from 'typeorm';
import { ApiException } from '../common/http';
import { PageDto } from '../auth/auth.dto';
import { CategoryCreateDto, CategoryPatchDto, CategoryQueryDto, ImageCreateDto, ProductCreateDto,
  ProductPatchDto, AdminProductQueryDto, SkuCreateDto, SkuPatchDto, StockDto, DateQueryDto } from './commerce.dto';
import { Category, Product, ProductImage, Sku, StockMovement, OrderItem, Quote } from './entities';
import { Actor, actorId, CommerceTransaction, canonical, checkVersion, conflict, defined, hash, missing, page, touch } from './transaction';
import { Content } from '../content/entities';

@Injectable()
export class CatalogService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction) {}
  async categories(q: CategoryQueryDto, admin = false) {
    const b = this.db.getRepository(Category).createQueryBuilder('c');
    if (q.scope) b.andWhere('c.scope = :scope', { scope: q.scope });
    else if (!admin) b.andWhere("c.scope = 'PRODUCT'");
    if (!admin) b.andWhere('c.enabled = true');
    if (q.keyword) b.andWhere('c.name LIKE :keyword', { keyword: `%${q.keyword}%` });
    if (q.parentId) b.andWhere('c.parentId = :parentId', { parentId: q.parentId });
    const [items, total] = await b.orderBy('c.sortOrder', 'ASC').addOrderBy('c.id', 'ASC')
      .skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
    return page(items.map(c => this.categoryView(c)), total, q);
  }
  categoryView(c: Category) { const { id, name, scope, parentId, sortOrder, enabled, version } = c; return { id, name, scope, parentId, sortOrder, enabled, version }; }
  async category(id: string) { const c = await this.db.getRepository(Category).findOneBy({ id }); if (!c) throw missing(); return this.categoryView(c); }
  async saveCategory(actor: Actor, dto: CategoryCreateDto | CategoryPatchDto, id?: string) {
    return this.tx.run(actor, async m => {
      // Category graph edits lock the graph in ID order to serialize cycle checks.
      const all = await m.find(Category, { order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
      const c = id ? all.find(x => x.id === id) : m.create(Category, { id: randomUUID(), scope: 'PRODUCT', parentId: null, enabled: true, sortOrder: 0, version: 1 });
      if (!c) throw missing();
      if (id) checkVersion(c, (dto as CategoryPatchDto).version);
      if (id && Object.keys(defined(dto)).length < 2) throw new ApiException(400, 'VALIDATION_ERROR', '请提供修改字段');
      Object.assign(c, defined(dto));
      if (c.parentId) {
        const visited = new Set([c.id]);
        let parent: string | null = c.parentId;
        while (parent) {
          if (visited.has(parent)) conflict('CATEGORY_CYCLE', '分类不能形成循环');
          visited.add(parent);
          const p = all.find(x => x.id === parent);
          if (!p) throw missing();
          if (p.scope !== c.scope) conflict('CATEGORY_SCOPE_MISMATCH', '父分类必须属于同一作用域');
          parent = p.parentId;
        }
      }
      if (id) touch(c);
      await m.save(c); await this.tx.audit(m, actor, id ? 'category.update' : 'category.create', c.id);
      return this.categoryView(c);
    });
  }
  async deleteCategory(actor: Actor, id: string, version: number) {
    return this.tx.run(actor, async m => {
      const all = await m.find(Category, { order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
      const c = all.find(x => x.id === id); if (!c) throw missing(); checkVersion(c, version);
      if (all.some(x => x.parentId === id) || await m.countBy(Product, { categoryId: id }) || await m.countBy(Content, { categoryId: id })) conflict('RESOURCE_IN_USE', '分类被子分类、产品或内容引用');
      await m.delete(Category, id); await this.tx.audit(m, actor, 'category.delete', id); return { success: true };
    });
  }
  imageView(i: ProductImage) { return { id: i.id, kind: 'IMAGE', status: 'READY', mimeType: i.mimeType, sizeBytes: i.sizeBytes, publicUrl: i.publicUrl }; }
  createImage(actor: Actor, dto: ImageCreateDto) {
    return this.tx.run(actor, async m => {
      const url = new URL(dto.publicUrl);
      if (url.username || url.password) throw new ApiException(400, 'VALIDATION_ERROR', '图片地址不能包含登录凭据');
      const i = m.create(ProductImage, { id: randomUUID(), ...dto, operatorId: actorId(actor) });
      await m.save(i); await this.tx.audit(m, actor, 'product-image.create', i.id);
      return this.imageView(i);
    });
  }
  private async references(m: EntityManager, p: Product) {
    const c = await m.findOneBy(Category, { id: p.categoryId, enabled: true, scope: 'PRODUCT' });
    if (!c) conflict('CATEGORY_UNAVAILABLE', '请选择启用的产品分类');
    const ids = [...new Set([p.coverMediaId, ...p.galleryMediaIds])];
    if (await m.countBy(ProductImage, { id: In(ids) }) !== ids.length) conflict('MEDIA_UNAVAILABLE', '产品图片不存在');
  }
  clean(html: string) {
    return sanitizeHtml(html, { allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote'], allowedAttributes: {} });
  }
  createProduct(actor: Actor, dto: ProductCreateDto) {
    return this.tx.run(actor, async m => {
      const p = m.create(Product, { id: randomUUID(), ...dto, galleryMediaIds: dto.galleryMediaIds ?? [], detailHtml: this.clean(dto.detailHtml), status: 'DRAFT', version: 1 });
      await this.references(m, p); await m.save(p); await this.tx.audit(m, actor, 'product.create', p.id);
      return this.productView(m, p, true);
    });
  }
  async lockProduct(m: EntityManager, id: string) {
    const p = await m.findOne(Product, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!p) throw missing(); return p;
  }
  patchProduct(actor: Actor, id: string, dto: ProductPatchDto) {
    return this.tx.run(actor, async m => {
      const p = await this.lockProduct(m, id); checkVersion(p, dto.version);
      if (Object.keys(defined(dto)).length < 2) throw new ApiException(400, 'VALIDATION_ERROR', '请提供修改字段');
      Object.assign(p, defined(dto)); p.detailHtml = this.clean(p.detailHtml); await this.references(m, p); touch(p);
      await m.save(p); await this.tx.audit(m, actor, 'product.update', p.id); return this.productView(m, p, true);
    });
  }
  publish(actor: Actor, id: string, version: number, status: 'PUBLISHED' | 'OFFLINE') {
    return this.tx.run(actor, async m => {
      const p = await this.lockProduct(m, id); checkVersion(p, version);
      if (status === 'PUBLISHED') {
        await this.references(m, p);
        if (!await m.countBy(Sku, { productId: id, enabled: true })) conflict('PRODUCT_NOT_READY', '至少需要一个启用 SKU');
      }
      p.status = status; touch(p); await m.save(p); await this.tx.audit(m, actor, `product.${status.toLowerCase()}`, id);
      return this.productView(m, p, true);
    });
  }
  deleteProduct(actor: Actor, id: string, version: number) {
    return this.tx.run(actor, async m => {
      const p = await this.lockProduct(m, id); checkVersion(p, version);
      if (p.status !== 'DRAFT' || await m.countBy(Sku, { productId: id }) || await m.countBy(OrderItem, { productId: id })) {
        conflict('RESOURCE_IN_USE', '只能删除无 SKU 和订单引用的草稿产品');
      }
      await m.delete(Product, id); await this.tx.audit(m, actor, 'product.delete', id); return { success: true };
    });
  }
  skuView(s: Sku, admin = false) {
    return { id: s.id, productId: s.productId, skuCode: s.skuCode, attributes: s.attributes, priceCents: s.priceCents,
      availableStock: s.onHandStock - s.reservedStock, enabled: s.enabled,
      ...(admin ? { onHandStock: s.onHandStock, reservedStock: s.reservedStock, version: s.version } : {}) };
  }
  async productView(m: EntityManager, p: Product, admin: boolean) {
    const skus = await m.find(Sku, { where: { productId: p.id, ...(!admin ? { enabled: true } : {}) }, order: { id: 'ASC' } });
    const imageIds = [...new Set([p.coverMediaId, ...p.galleryMediaIds])];
    const images = await m.findBy(ProductImage, { id: In(imageIds) });
    const c = await m.findOneByOrFail(Category, { id: p.categoryId });
    const sellable = skus.filter(x => x.enabled);
    const prices = sellable.map(x => x.priceCents);
    return { id: p.id, name: p.name, summary: p.summary, cover: this.imageView(images.find(x => x.id === p.coverMediaId)!),
      category: this.categoryView(c), minPriceCents: prices.length ? Math.min(...prices) : 0,
      maxPriceCents: prices.length ? Math.max(...prices) : 0, currency: 'CNY', inStock: sellable.some(x => x.onHandStock > x.reservedStock),
      detailHtml: p.detailHtml, gallery: p.galleryMediaIds.map(id => this.imageView(images.find(i => i.id === id)!)),
      skus: skus.map(s => this.skuView(s, admin)), afterSalePolicy: p.afterSalePolicy,
      ...(admin ? { status: p.status, version: p.version, createdAt: p.createdAt, updatedAt: p.updatedAt } : {}) };
  }
  async product(id: string, admin = false) {
    const p = await this.db.getRepository(Product).findOneBy({ id });
    if (!p || (!admin && (p.status !== 'PUBLISHED' || !await this.db.getRepository(Category).existsBy({ id: p.categoryId, enabled: true })))) throw missing();
    return this.productView(this.db.manager, p, admin);
  }
  async products(q: AdminProductQueryDto, admin = false) {
    const b = this.db.getRepository(Product).createQueryBuilder('p');
    if (!admin) b.innerJoin(Category, 'c', 'c.id = p.categoryId AND c.enabled = true').andWhere('p.status = :published', { published: 'PUBLISHED' });
    if (admin && q.status) b.andWhere('p.status = :status', { status: q.status });
    if (q.categoryId) b.andWhere('p.categoryId = :categoryId', { categoryId: q.categoryId });
    if (q.keyword) b.andWhere('p.name LIKE :keyword', { keyword: `%${q.keyword}%` });
    if (q.minPriceCents !== undefined && q.maxPriceCents !== undefined && q.minPriceCents > q.maxPriceCents) throw new ApiException(400, 'VALIDATION_ERROR', '价格区间不合法');
    if (q.minPriceCents !== undefined) b.andWhere('(SELECT MIN(s.price_cents) FROM product_skus s WHERE s.product_id = p.id AND s.enabled = 1) >= :min', { min: q.minPriceCents });
    if (q.maxPriceCents !== undefined) b.andWhere('(SELECT MIN(s.price_cents) FROM product_skus s WHERE s.product_id = p.id AND s.enabled = 1) <= :max', { max: q.maxPriceCents });
    if (q.inStock !== undefined) b.andWhere(`${q.inStock ? '' : 'NOT '}EXISTS (SELECT 1 FROM product_skus s WHERE s.product_id = p.id AND s.enabled = 1 AND s.on_hand_stock > s.reserved_stock)`);
    if (q.sort === 'priceCents:asc' || q.sort === 'priceCents:desc') b.addSelect('(SELECT MIN(s.price_cents) FROM product_skus s WHERE s.product_id = p.id AND s.enabled = 1)', 'price_sort').orderBy('price_sort', q.sort === 'priceCents:asc' ? 'ASC' : 'DESC');
    else b.orderBy('p.createdAt', 'DESC');
    const [items, total] = await b.addOrderBy('p.id', 'DESC').skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
    return page(await Promise.all(items.map(async p => {
      const result = await this.productView(this.db.manager, p, admin);
      if (admin) return result;
      const { detailHtml: _html, gallery: _gallery, skus: _skus, afterSalePolicy: _policy, ...summary } = result;
      return summary;
    })), total, q);
  }
  private attributes(input: { name: string; value: string }[]) {
    const attrs = input.map(x => ({ name: x.name.trim(), value: x.value.trim() })).sort((a,b) => a.name.localeCompare(b.name));
    if (new Set(attrs.map(x => x.name)).size !== attrs.length) conflict('SKU_ATTRIBUTES_INVALID', '规格维度不可重复');
    return { attributes: attrs, attributesHash: hash(canonical(attrs)) };
  }
  createSku(actor: Actor, productId: string, dto: SkuCreateDto) {
    return this.tx.run(actor, async m => {
      const p = await this.lockProduct(m, productId);
      const s = m.create(Sku, { id: randomUUID(), productId, ...dto, ...this.attributes(dto.attributes), enabled: dto.enabled ?? true, onHandStock: 0, reservedStock: 0, version: 1 });
      await m.save(s); touch(p); await m.save(p); await this.tx.audit(m, actor, 'sku.create', s.id); return this.skuView(s, true);
    });
  }
  async sku(id: string) { const s = await this.db.getRepository(Sku).findOneBy({ id }); if (!s) throw missing(); return this.skuView(s, true); }
  async skus(productId: string, q: PageDto) {
    if (!await this.db.getRepository(Product).existsBy({ id: productId })) throw missing();
    const [items, total] = await this.db.getRepository(Sku).findAndCount({ where: { productId }, order: { createdAt: 'DESC', id: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
    return page(items.map(s => this.skuView(s, true)), total, q);
  }
  async lockSkuAndProduct(m: EntityManager, id: string) {
    const candidate = await m.findOneBy(Sku, { id }); if (!candidate) throw missing();
    const p = await this.lockProduct(m, candidate.productId);
    const s = await m.findOne(Sku, { where: { id }, lock: { mode: 'pessimistic_write' } }); if (!s) throw missing();
    return { p, s };
  }
  patchSku(actor: Actor, id: string, dto: SkuPatchDto) {
    return this.tx.run(actor, async m => {
      const { p, s } = await this.lockSkuAndProduct(m, id); checkVersion(s, dto.version);
      if (Object.keys(defined(dto)).length < 2) throw new ApiException(400, 'VALIDATION_ERROR', '请提供修改字段');
      const wasEnabled = s.enabled;
      Object.assign(s, defined(dto)); if (dto.attributes) Object.assign(s, this.attributes(dto.attributes));
      if (wasEnabled && !s.enabled && p.status === 'PUBLISHED' && await m.countBy(Sku, { productId: p.id, enabled: true }) <= 1) conflict('PRODUCT_NOT_READY', '请先下架产品再停用最后一个 SKU');
      touch(s); touch(p); await m.save(s); await m.save(p); await this.tx.audit(m, actor, 'sku.update', id); return this.skuView(s, true);
    });
  }
  deleteSku(actor: Actor, id: string, version: number) {
    return this.tx.run(actor, async m => {
      const { p, s } = await this.lockSkuAndProduct(m, id); checkVersion(s, version);
      if (p.status === 'PUBLISHED' || s.onHandStock || s.reservedStock || await m.countBy(OrderItem, { resourceId: id }) || await m.countBy(StockMovement, { skuId: id })) conflict('RESOURCE_IN_USE', 'SKU 已发布、有库存或历史引用，只能停用');
      const quoted = await m.getRepository(Quote).createQueryBuilder('q').where("JSON_SEARCH(q.items, 'one', :skuId, NULL, '$[*].resourceId') IS NOT NULL", { skuId: id }).getCount();
      if (quoted) conflict('RESOURCE_IN_USE', 'SKU 已有报价引用，只能停用');
      await m.delete(Sku, id); touch(p); await m.save(p); await this.tx.audit(m, actor, 'sku.delete', id); return { success: true };
    });
  }
  async moveStock(m: EntityManager, s: Sku, delta: number, reservedDelta: number, reason: string, operatorId: string, orderId: string | null = null) {
    s.onHandStock += delta; s.reservedStock += reservedDelta;
    if (s.reservedStock < 0 || s.onHandStock < s.reservedStock || s.onHandStock > 100000000) conflict('STOCK_INSUFFICIENT', '库存不足或调整后低于预占数量');
    touch(s); await m.save(s);
    const movement = m.create(StockMovement, { id: randomUUID(), skuId: s.id, delta, reservedDelta,
      onHandStockAfter: s.onHandStock, reservedStockAfter: s.reservedStock, reason, operatorId, orderId });
    await m.save(movement); return movement;
  }
  adjustStock(actor: Actor, id: string, dto: StockDto, key?: string) {
    return this.tx.run(actor, async m => {
      const { s } = await this.lockSkuAndProduct(m, id); checkVersion(s, dto.version);
      const result = await this.moveStock(m, s, dto.delta, 0, dto.reason, actorId(actor));
      await this.tx.audit(m, actor, 'stock.adjust', id, { delta: dto.delta, reason: dto.reason }); return result;
    }, { key, action: `stock:${id}`, body: dto });
  }
  async stockHistory(id: string, q: DateQueryDto) {
    if (!await this.db.getRepository(Sku).existsBy({ id })) throw missing();
    const b = this.db.getRepository(StockMovement).createQueryBuilder('s').where('s.skuId = :id', { id });
    if (q.createdFrom) b.andWhere('s.createdAt >= :from', { from: new Date(q.createdFrom) });
    if (q.createdTo) b.andWhere('s.createdAt <= :to', { to: new Date(q.createdTo) });
    const [items, total] = await b.orderBy('s.createdAt', 'DESC').addOrderBy('s.id', 'DESC').skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
    return page(items, total, q);
  }
}
