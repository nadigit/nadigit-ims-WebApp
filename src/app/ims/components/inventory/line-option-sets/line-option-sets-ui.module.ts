import { NgModule } from '@angular/core';
import { PageNoteComponent } from 'src/app/shared/page-note';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LineOptionSetsComponent } from './line-option-sets.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'src/app/shared/shared.module';

/** UI-only module so the component can be embedded elsewhere without registering lazy routes twice. */
@NgModule({
  imports: [
    PageNoteComponent,
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    RippleModule,
    ToastModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    AutoCompleteModule,
    DialogModule,
    CheckboxModule,
    ConfirmDialogModule,
    ProgressSpinnerModule,
    TagModule,
    TooltipModule,
    TranslateModule,
    SharedModule
  ],
  declarations: [LineOptionSetsComponent],
  exports: [LineOptionSetsComponent]
})
export class LineOptionSetsUiModule {}
