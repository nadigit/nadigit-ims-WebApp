import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { SharedModule } from 'src/app/shared/shared.module';
import { SupplierFormDialogComponent } from './supplier-form-dialog.component';

/**
 * The supplier form on its own. Screens used to import SuppliersModule to get it, which also
 * brought in the suppliers routing module and registered supplier routes under the importer.
 */
@NgModule({
  declarations: [SupplierFormDialogComponent],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    DialogModule,
    ButtonModule,
    RippleModule,
    InputTextModule,
    TextareaModule,
    InputSwitchModule,
    DropdownModule,
    SharedModule,
  ],
  exports: [SupplierFormDialogComponent],
})
export class SupplierFormDialogModule {}
