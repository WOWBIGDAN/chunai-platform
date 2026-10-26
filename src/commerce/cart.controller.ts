import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PageDto } from '../auth/auth.dto';
import { ApiRequest } from '../common/http';
import { Actor } from './transaction';
import { CartItemPutDto, CartQuoteDto } from './cart.dto';
import { VersionQueryDto } from './commerce.dto';
import { CartService } from './cart.service';
import { OrdersService } from './orders.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const actor = (r: ApiRequest): Actor => ({ kind: 'user', principal: r.principal! });
@Controller('me/cart')
@UseGuards(AuthGuard)
export class CartController {
  constructor(private readonly cart: CartService, private readonly orders: OrdersService) {}
  @Get() list(@Req() r: ApiRequest, @Query() q: PageDto) { return this.cart.list(r.principal!.user.id, q); }
  @Put('items/:skuId') put(@Req() r: ApiRequest, @Param('skuId', uuid) skuId: string, @Body() d: CartItemPutDto) { return this.cart.put(actor(r), skuId, d); }
  @Delete('items/:skuId') remove(@Req() r: ApiRequest, @Param('skuId', uuid) skuId: string, @Query() q: VersionQueryDto) { return this.cart.remove(actor(r), skuId, q.version); }
  @Post('quote') quote(@Req() r: ApiRequest, @Body() d: CartQuoteDto) { return this.orders.createCartQuote(actor(r), d); }
}
