import { Module } from '@nestjs/common';
import { ProduitsModule } from '../produits/produits.module';
import { AdminConnexionController, AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({ imports: [ProduitsModule], controllers: [AdminConnexionController, AdminController], providers: [AdminService, AdminGuard], exports: [AdminService, AdminGuard] })
export class AdminModule {}
