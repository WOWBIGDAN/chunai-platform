import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { PageDto } from '../auth/auth.dto';
import { CartItem, Category, Product, ProductImage, Sku } from './entities';
import { CartItemPutDto } from './cart.dto';
import { Actor, actorId, checkVersion, CommerceTransaction, conflict, missing, page, touch } from './transaction';
import { CatalogService } from './catalog.service';
import { productAvailability } from './product-availability';

@Injectable()
export class CartService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction, private readonly catalog: CatalogService) {}

  private async views(m: EntityManager, items: CartItem[]) {
    if (!items.length) return [];
    const skus = new Map((await m.findBy(Sku, { id: In(items.map(i => i.skuId)) })).map(s => [s.id, s]));
    const products = new Map((await m.findBy(Product, { id: In([...skus.values()].map(s => s.productId)) })).map(p => [p.id, p]));
    const categories = new Map((await m.findBy(Category, { id: In([...products.values()].map(p => p.categoryId)) })).map(c => [c.id, c]));
    const covers = new Map((await m.findBy(ProductImage, { id: In([...products.values()].map(p => p.coverMediaId)) })).map(c => [c.id, c.publicUrl]));
    return items.map(i => {
      const sku = skus.get(i.skuId)!, product = products.get(sku.productId)!;
      const availability = productAvailability(product, sku, categories.get(product.categoryId) ?? null, i.quantity);
      const visible = product.status === 'PUBLISHED' && categories.get(product.categoryId)?.enabled && categories.get(product.categoryId)?.scope === 'PRODUCT';
      return { id: i.id, skuId: i.skuId, productId: product.id, quantity: i.quantity, selected: i.selected,
        version: i.version, createdAt: i.createdAt, updatedAt: i.updatedAt,
        availability, canPurchase: availability === 'AVAILABLE',
        availableStock: sku.onHandStock - sku.reservedStock, maxQuantity: Math.min(999, sku.onHandStock - sku.reservedStock),
        product: visible ? { name: product.name, coverUrl: covers.get(product.coverMediaId) ?? null,
          skuAttributes: sku.attributes, unitPriceCents: sku.priceCents, subtotalCents: sku.priceCents * i.quantity, currency: 'CNY' } : null };
    });
  }
  list(userId: string, q: PageDto) {
    return this.db.transaction('REPEATABLE READ', async m => {
      const [items, total] = await m.findAndCount(CartItem, { where: { userId }, order: { createdAt: 'DESC', id: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
      return page(await this.views(m, items), total, q);
    });
  }
  put(actor: Actor, skuId: string, dto: CartItemPutDto) {
    return this.tx.run(actor, async m => {
      const userId = actorId(actor);
      const previous = await m.findOneBy(CartItem, { userId, skuId });
      if (previous) checkVersion(previous, dto.version);
      else if (dto.version !== 0) conflict('VERSION_CONFLICT', '购物车条目已移除，请刷新后重试');
      if (!previous && await m.countBy(CartItem, { userId }) >= 200) conflict('CART_LIMIT', '购物车最多保存 200 种 SKU');
      // Follow the same product -> SKU lock order as stock and order mutations.
      const candidate = await m.findOneBy(Sku, { id: skuId }); if (!candidate) throw missing();
      const product = await this.catalog.lockProduct(m, candidate.productId);
      const sku = await m.findOne(Sku, { where: { id: skuId }, lock: { mode: 'pessimistic_write' } }); if (!sku) throw missing();
      const category = await m.findOne(Category, { where: { id: product.categoryId }, lock: { mode: 'pessimistic_read' } });
      const availability = productAvailability(product, sku, category, dto.quantity);
      // Reducing a stale quantity or deselecting an unavailable item remains possible.
      const selected = dto.selected ?? previous?.selected ?? true;
      if (!previous || dto.quantity > previous.quantity || (selected && !previous.selected)) {
        if (availability !== 'AVAILABLE') conflict(availability, '商品当前不可购买或所选数量超过可售库存');
      }
      const item = previous ?? m.create(CartItem, { id: randomUUID(), userId, skuId, quantity: dto.quantity, selected, version: 1 });
      if (!previous || previous.quantity !== dto.quantity || previous.selected !== selected) {
        item.quantity = dto.quantity; item.selected = selected;
        if (previous) touch(item);
        await m.save(item);
      }
      return (await this.views(m, [item]))[0];
    });
  }
  remove(actor: Actor, skuId: string, version: number) {
    return this.tx.run(actor, async m => {
      const item = await m.findOneBy(CartItem, { userId: actorId(actor), skuId });
      if (item) { checkVersion(item, version); await m.delete(CartItem, item.id); }
      return { success: true };
    });
  }
}
