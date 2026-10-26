import { Category, Product, Sku } from './entities';

/** Cart quantities never reserve stock. Only order creation changes reservedStock. */
export function productAvailability(product: Product, sku: Sku, category: Category | null, quantity: number) {
  if (product.status !== 'PUBLISHED') return 'PRODUCT_UNAVAILABLE' as const;
  if (!category?.enabled || category.scope !== 'PRODUCT') return 'CATEGORY_UNAVAILABLE' as const;
  if (!sku.enabled) return 'SKU_DISABLED' as const;
  const available = sku.onHandStock - sku.reservedStock;
  if (available <= 0) return 'OUT_OF_STOCK' as const;
  if (quantity > available) return 'STOCK_INSUFFICIENT' as const;
  return 'AVAILABLE' as const;
}
