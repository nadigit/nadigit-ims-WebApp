import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DropdownModule } from 'primeng/dropdown';
import { SharedModule } from 'src/app/shared/shared.module';
import { WarehouseFormDialogComponent } from './warehouse-form-dialog.component';

/**
 * The warehouse form on its own, so any screen can offer "new warehouse" without importing the
 * whole inventory module (and without the circular import that would create for quick-create).
 */
@NgModule({
  declarations: [WarehouseFormDialogComponent],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    DialogModule,
    ButtonModule,
    RippleModule,
    InputTextModule,
    TextareaModule,
    DropdownModule,
    SharedModule,
  ],
  exports: [WarehouseFormDialogComponent],
})
export class WarehouseFormDialogModule {}
