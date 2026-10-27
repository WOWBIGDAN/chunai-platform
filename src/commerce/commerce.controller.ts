import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import { PageDto } from '../auth/auth.dto';
import { ApiRequest } from '../common/http';
import { AdminGuard, AdminRequest, RequirePermission } from './admin-auth';
import { CatalogService } from './catalog.service';
import { OrdersService } from './orders.service';
import { AfterSalesService } from './aftersales.service';
import { Actor, CommerceTransaction, missing, page } from './transaction';
import { Address, AuditLog } from './entities';
import { Permission } from './permissions';
import * as D from './commerce.dto';
import { LogisticsService } from './logistics.service';
import { CARRIERS } from './logistics-provider';

const uuid = new ParseUUIDPipe({ version: '4' });
const user = (r: ApiRequest): Actor => ({ kind: 'user', principal: r.principal! });
const admin = (r: AdminRequest, permission: Permission): Actor => ({ kind: 'admin', principal: r.admin, permission });

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get('categories') categories(@Query() q: D.CategoryQueryDto) { return this.catalog.categories(q); }
  @Get('products') products(@Query() q: D.ProductQueryDto) { return this.catalog.products(q); }
  @Get('products/:id') product(@Param('id', uuid) id: string) { return this.catalog.product(id); }
}

@Controller()
@UseGuards(AuthGuard)
export class CustomerCommerceController {
  constructor(private readonly orders: OrdersService, private readonly sales: AfterSalesService, private readonly db: DataSource, private readonly tracking: LogisticsService) {}
  @Get('me/addresses') addresses(@Req() r: ApiRequest, @Query() q: PageDto) { return this.orders.addresses(r.principal!.user.id, q); }
  @Get('me/addresses/:id') async address(@Req() r: ApiRequest, @Param('id', uuid) id: string) {
    const a = await this.db.getRepository(Address).findOneBy({ id, userId: r.principal!.user.id }); if (!a) throw missing();
    return { id: a.id, ...a.snapshot, isDefault: a.isDefault, version: a.version };
  }
  @Post('me/addresses') addressCreate(@Req() r: ApiRequest, @Body() d: D.AddressCreateDto) { return this.orders.saveAddress(user(r), d); }
  @Put('me/addresses/:id') addressReplace(@Req() r: ApiRequest, @Param('id', uuid) id: string, @Body() d: D.AddressReplaceDto) { return this.orders.saveAddress(user(r), d, id); }
  @Delete('me/addresses/:id') addressDelete(@Req() r: ApiRequest, @Param('id', uuid) id: string, @Query() q: D.VersionQueryDto) { return this.orders.deleteAddress(user(r), id, q.version); }
  @Post('order-quotes') quote(@Req() r: ApiRequest, @Body() d: D.QuoteDto) { return this.orders.createQuote(user(r), d); }
  @Post('orders') orderCreate(@Req() r: ApiRequest, @Body() d: D.CreateOrderDto, @Headers('idempotency-key') key?: string) { return this.orders.createOrder(user(r), d, key); }
  @Get('orders') ordersList(@Req() r: ApiRequest, @Query() q: D.OrderQueryDto) { return this.orders.list(q, r.principal!.user.id); }
  @Get('orders/:id') order(@Req() r: ApiRequest, @Param('id', uuid) id: string) { return this.orders.getOrder(id, r.principal!.user.id); }
  @Post('orders/:id/cancel') @HttpCode(200)
  cancel(@Req() r: ApiRequest, @Param('id', uuid) id: string, @Body() d: D.CancelOrderDto, @Headers('idempotency-key') key?: string) { return this.orders.cancel(user(r), id, d, key); }
  @Post('orders/:id/confirm-receipt') @HttpCode(200)
  receipt(@Req() r: ApiRequest, @Param('id', uuid) id: string, @Body() d: D.VersionDto, @Headers('idempotency-key') key?: string) { return this.orders.confirmReceipt(user(r), id, d, key); }
  @Get('orders/:id/logistics') logistics(@Req() r: ApiRequest, @Param('id', uuid) id: string) { return this.tracking.read(id, r.principal!.user.id); }
  @Get('orders/:id/refunds') refunds(@Req() r: ApiRequest, @Param('id', uuid) id: string, @Query() q: D.RefundQueryDto) { return this.sales.refunds(q, id, r.principal!.user.id); }
  @Post('aftersales') saleCreate(@Req() r: ApiRequest, @Body() d: D.AfterSaleCreateDto, @Headers('idempotency-key') key?: string) { return this.sales.create(user(r), d, key); }
  @Get('aftersales') salesList(@Req() r: ApiRequest, @Query() q: D.AfterSaleQueryDto) { return this.sales.list(q, r.principal!.user.id); }
  @Get('aftersales/:id') sale(@Req() r: ApiRequest, @Param('id', uuid) id: string) { return this.sales.get(id, r.principal!.user.id); }
  @Post('aftersales/:id/cancel') @HttpCode(200)
  saleCancel(@Req() r: ApiRequest, @Param('id', uuid) id: string, @Body() d: D.VersionDto, @Headers('idempotency-key') key?: string) { return this.sales.cancel(user(r), id, d, key); }
  @Post('aftersales/:id/return-shipment') @HttpCode(200)
  saleReturn(@Req() r: ApiRequest, @Param('id', uuid) id: string, @Body() d: D.ReturnShipmentDto, @Headers('idempotency-key') key?: string) { return this.sales.returnShipment(user(r), id, d, key); }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get('categories') @RequirePermission('content:write') categories(@Query() q: D.CategoryQueryDto) { return this.catalog.categories(q, true); }
  @Get('categories/:id') @RequirePermission('content:write') category(@Param('id', uuid) id: string) { return this.catalog.category(id); }
  @Post('categories') @RequirePermission('content:write') createCategory(@Req() r: AdminRequest, @Body() d: D.CategoryCreateDto) { return this.catalog.saveCategory(admin(r, 'content:write'), d); }
  @Patch('categories/:id') @RequirePermission('content:write') patchCategory(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.CategoryPatchDto) { return this.catalog.saveCategory(admin(r, 'content:write'), d, id); }
  @Delete('categories/:id') @RequirePermission('content:write') deleteCategory(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Query() q: D.VersionQueryDto) { return this.catalog.deleteCategory(admin(r, 'content:write'), id, q.version); }
  @Post('product-images') @RequirePermission('products:write') image(@Req() r: AdminRequest, @Body() d: D.ImageCreateDto) { return this.catalog.createImage(admin(r, 'products:write'), d); }
  @Get('products') @RequirePermission('products:write') products(@Query() q: D.AdminProductQueryDto) { return this.catalog.products(q, true); }
  @Get('products/:id') @RequirePermission('products:write') product(@Param('id', uuid) id: string) { return this.catalog.product(id, true); }
  @Post('products') @RequirePermission('products:write') create(@Req() r: AdminRequest, @Body() d: D.ProductCreateDto) { return this.catalog.createProduct(admin(r, 'products:write'), d); }
  @Patch('products/:id') @RequirePermission('products:write') patch(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.ProductPatchDto) { return this.catalog.patchProduct(admin(r, 'products:write'), id, d); }
  @Delete('products/:id') @RequirePermission('products:write') remove(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Query() q: D.VersionQueryDto) { return this.catalog.deleteProduct(admin(r, 'products:write'), id, q.version); }
  @Post('products/:id/publish') @HttpCode(200) @RequirePermission('products:write') publish(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.VersionDto) { return this.catalog.publish(admin(r, 'products:write'), id, d.version, 'PUBLISHED'); }
  @Post('products/:id/unpublish') @HttpCode(200) @RequirePermission('products:write') unpublish(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.VersionDto) { return this.catalog.publish(admin(r, 'products:write'), id, d.version, 'OFFLINE'); }
  @Get('products/:id/skus') @RequirePermission('products:write') skus(@Param('id', uuid) id: string, @Query() q: PageDto) { return this.catalog.skus(id, q); }
  @Post('products/:id/skus') @RequirePermission('products:write') createSku(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.SkuCreateDto) { return this.catalog.createSku(admin(r, 'products:write'), id, d); }
  @Get('skus/:id') @RequirePermission('products:write') sku(@Param('id', uuid) id: string) { return this.catalog.sku(id); }
  @Patch('skus/:id') @RequirePermission('products:write') patchSku(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.SkuPatchDto) { return this.catalog.patchSku(admin(r, 'products:write'), id, d); }
  @Delete('skus/:id') @RequirePermission('products:write') deleteSku(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Query() q: D.VersionQueryDto) { return this.catalog.deleteSku(admin(r, 'products:write'), id, q.version); }
  @Post('skus/:id/stock-adjustments') @RequirePermission('products:write') stock(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.StockDto, @Headers('idempotency-key') key?: string) { return this.catalog.adjustStock(admin(r, 'products:write'), id, d, key); }
  @Get('skus/:id/stock-adjustments') @RequirePermission('products:write') stockHistory(@Param('id', uuid) id: string, @Query() q: D.DateQueryDto) { return this.catalog.stockHistory(id, q); }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminFulfilmentController {
  constructor(private readonly orders: OrdersService, private readonly sales: AfterSalesService, private readonly db: DataSource, private readonly tx: CommerceTransaction, private readonly tracking: LogisticsService) {}
  private async auditedRead<T>(actor: Actor, action: string, id: string, read: () => Promise<T>) {
    const result = await read();
    await this.tx.run(actor, async m => { await this.tx.audit(m, actor, action, id); });
    return result;
  }
  @Get('orders') @RequirePermission('orders:read') ordersList(@Query() q: D.AdminOrderQueryDto) { return this.orders.list(q); }
  @Get('orders/:id') @RequirePermission('orders:read') order(@Req() r: AdminRequest, @Param('id', uuid) id: string) { return this.auditedRead(admin(r, 'orders:read'), 'order.read', id, () => this.orders.getOrder(id)); }
  @Get('orders/:id/logistics') @RequirePermission('orders:read') logistics(@Param('id', uuid) id: string) { return this.tracking.read(id); }
  @Get('logistics/carriers') @RequirePermission('orders:ship') carriers() { return { items: Object.entries(CARRIERS).map(([code, c]) => ({ code, name: c.name, phoneLast4Required: c.phoneRequired })) }; }
  @Post('shipments/:id/sync') @HttpCode(200) @RequirePermission('orders:ship') sync(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.VersionDto) { return this.tracking.refresh(admin(r, 'orders:ship'), id, d.version); }
  @Post('orders/:id/shipment') @RequirePermission('orders:ship') ship(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.ShipmentDto, @Headers('idempotency-key') key?: string) { return this.orders.ship(admin(r, 'orders:ship'), id, d, key); }
  @Patch('shipments/:id') @RequirePermission('orders:ship') correctShipment(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.ShipmentPatchDto) { return this.orders.patchShipment(admin(r, 'orders:ship'), id, d); }
  @Post('shipments/:id/events') @HttpCode(200) @RequirePermission('orders:ship') event(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.LogisticsEventDto, @Headers('idempotency-key') key?: string) { return this.orders.addLogisticsEvent(admin(r, 'orders:ship'), id, d, key); }
  @Post('orders/:id/test-payment') @HttpCode(200) @RequirePermission('payments:test') testPayment(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.TestPaymentDto, @Headers('idempotency-key') key?: string) { return this.orders.testPay(admin(r, 'payments:test'), id, d, key); }
  @Post('orders/:id/digital-refund') @HttpCode(202) @RequirePermission('aftersales:review') digitalRefund(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.DigitalRefundDto, @Headers('idempotency-key') key?: string) { return this.sales.digitalRefund(admin(r, 'aftersales:review'), id, d, key); }
  @Get('aftersales') @RequirePermission('aftersales:review') salesList(@Query() q: D.AdminAfterSaleQueryDto) { return this.sales.list(q); }
  @Get('aftersales/:id') @RequirePermission('aftersales:review') sale(@Req() r: AdminRequest, @Param('id', uuid) id: string) { return this.auditedRead(admin(r, 'aftersales:review'), 'aftersale.read', id, () => this.sales.get(id)); }
  @Post('aftersales/:id/review') @HttpCode(200) @RequirePermission('aftersales:review') review(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.ReviewDto, @Headers('idempotency-key') key?: string) { return this.sales.review(admin(r, 'aftersales:review'), id, d, key); }
  @Post('aftersales/:id/confirm-return') @HttpCode(200) @RequirePermission('aftersales:review') confirmReturn(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.ReturnReceiptDto, @Headers('idempotency-key') key?: string) { return this.sales.confirmReturn(admin(r, 'aftersales:review'), id, d, key); }
  @Post('aftersales/:id/retry-refund') @HttpCode(200) @RequirePermission('aftersales:review') retry(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.VersionDto, @Headers('idempotency-key') key?: string) { return this.sales.retryRefund(admin(r, 'aftersales:review'), id, d, key); }
  @Get('refunds') @RequirePermission('aftersales:review') refunds(@Query() q: D.RefundQueryDto) { return this.sales.refunds(q); }
  @Post('refunds/:id/test-result') @HttpCode(200) @RequirePermission('payments:test') testRefund(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.TestRefundDto, @Headers('idempotency-key') key?: string) { return this.sales.testRefund(admin(r, 'payments:test'), id, d, key); }
  @Get('commerce-audit-logs') @RequirePermission('audit:read') async audit(@Query() q: PageDto) {
    const [items, total] = await this.db.getRepository(AuditLog).findAndCount({ order: { createdAt: 'DESC', id: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
    return page(items, total, q);
  }
}
