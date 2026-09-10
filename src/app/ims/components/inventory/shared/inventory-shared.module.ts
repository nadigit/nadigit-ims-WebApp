import { NgModule } from '@angular/core';
import { CategoryFormDialogComponent } from '../categories/category-form-dialog/category-form-dialog.component';
import { ImageUploadComponent } from 'src/app/shared/components/image-upload/image-upload.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { FileUploadModule } from 'primeng/fileupload';
import { ImageModule } from 'primeng/image';
import { GalleriaModule } from 'primeng/galleria';
import { CheckboxModule } from 'primeng/checkbox';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { SharedModule } from 'src/app/shared/shared.module';

// Shared components
import { WarehouseFormDialogComponent } from '../warehouses/warehouse-form-dialog/warehouse-form-dialog.component';
import { ProductFormComponent } from '../products/product-form/product-form.component';
import { ProductDeleteDialogComponent } from '../products/product-delete-dialog/product-delete-dialog.component';
import { ProductArchiveDialogComponent } from '../products/product-archive-dialog/product-archive-dialog.component';
import { CategoryDeleteDialogComponent } from '../categories/category-delete-dialog/category-delete-dialog.component';
import { WarehouseDeleteDialogComponent } from '../warehouses/warehouse-delete-dialog/warehouse-delete-dialog.component';
import { SupplierDeleteDialogComponent } from '../../purchases/suppliers/supplier-delete-dialog/supplier-delete-dialog.component';
import { VariantProductPickerComponent } from './variant-product-picker/variant-product-picker.component';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageModule } from 'primeng/message';

@NgModule({
  declarations: [
    CategoryFormDialogComponent,
    WarehouseFormDialogComponent,
    ProductFormComponent,
    ProductDeleteDialogComponent,
    ProductArchiveDialogComponent,
    CategoryDeleteDialogComponent,
    WarehouseDeleteDialogComponent,
    SupplierDeleteDialogComponent,
    VariantProductPickerComponent,
  ],
  imports: [
    CommonModule,
    ImageUploadComponent,
    FormsModule,
    TranslateModule,
    SharedModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    InputTextareaModule,
    FileUploadModule,
    ImageModule,
    GalleriaModule,
    CheckboxModule,
    CalendarModule,
    TooltipModule,
    RippleModule,
    ProgressSpinnerModule,
    AutoCompleteModule,
    MessageModule,
  ],
  exports: [
    CategoryFormDialogComponent,
    WarehouseFormDialogComponent,
    ProductFormComponent,
    ProductDeleteDialogComponent,
    ProductArchiveDialogComponent,
    CategoryDeleteDialogComponent,
    WarehouseDeleteDialogComponent,
    SupplierDeleteDialogComponent,
    VariantProductPickerComponent,
  ]
})
export class InventorySharedModule { }