import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ChipModule } from 'primeng/chip';
import { SharedModule } from 'src/app/shared/shared.module';
import { ProductFamiliesRoutingModule } from './product-families-routing.module';
import { ProductFamiliesComponent } from './product-families.component';
import { ProductFamilyFormDialogComponent } from './product-family-form-dialog/product-family-form-dialog.component';
import { GenerateVariantsDialogComponent } from './generate-variants-dialog/generate-variants-dialog.component';

@NgModule({
  declarations: [
    ProductFamiliesComponent,
    ProductFamilyFormDialogComponent,
    GenerateVariantsDialogComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    SharedModule,
    ProductFamiliesRoutingModule,
    TableModule,
    ButtonModule,
    RippleModule,
    ToastModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    DialogModule,
    InputNumberModule,
    TagModule,
    TooltipModule,
    ProgressSpinnerModule,
    ChipModule,
  ],
})
export class ProductFamiliesModule {}
