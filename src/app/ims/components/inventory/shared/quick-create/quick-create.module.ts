import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupplierFormDialogModule } from '../../../purchases/suppliers/supplier-form-dialog/supplier-form-dialog.module';
import { WarehouseFormDialogModule } from '../../warehouses/warehouse-form-dialog/warehouse-form-dialog.module';
import { ShopFormDialogModule } from '../../shops/shop-form-dialog/shop-form-dialog.module';
import { QuickCreateDialogsComponent } from './quick-create-dialogs.component';

@NgModule({
  declarations: [QuickCreateDialogsComponent],
  imports: [CommonModule, SupplierFormDialogModule, WarehouseFormDialogModule, ShopFormDialogModule],
  exports: [QuickCreateDialogsComponent],
})
export class QuickCreateModule {}
