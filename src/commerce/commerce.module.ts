import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from './admin-auth';
import { AdminCatalogController, AdminFulfilmentController, CatalogController, CustomerCommerceController } from './commerce.controller';
import { CatalogService } from './catalog.service';
import { OrdersService } from './orders.service';
import { AfterSalesService } from './aftersales.service';
import { CommerceTransaction } from './transaction';
import { CommerceMaintenance } from './maintenance.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { LogisticsProvider } from './logistics-provider';
import { LogisticsService } from './logistics.service';

@Module({ imports: [AuthModule, AdminAuthModule],
  controllers: [CatalogController, CustomerCommerceController, AdminCatalogController, AdminFulfilmentController, CartController],
  providers: [CommerceTransaction, CatalogService, OrdersService, AfterSalesService, CommerceMaintenance, CartService, LogisticsProvider, LogisticsService],
  exports: [CommerceTransaction, CatalogService] })
export class CommerceModule {}
