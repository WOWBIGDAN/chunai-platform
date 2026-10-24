import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from './admin-auth';
import { AdminCatalogController, AdminFulfilmentController, CatalogController, CustomerCommerceController } from './commerce.controller';
import { CatalogService } from './catalog.service';
import { OrdersService } from './orders.service';
import { AfterSalesService } from './aftersales.service';
import { CommerceTransaction } from './transaction';
import { CommerceMaintenance } from './maintenance.service';

@Module({ imports: [AuthModule, AdminAuthModule],
  controllers: [CatalogController, CustomerCommerceController, AdminCatalogController, AdminFulfilmentController],
  providers: [CommerceTransaction, CatalogService, OrdersService, AfterSalesService, CommerceMaintenance] })
export class CommerceModule {}
