import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LineOptionSetsComponent } from './line-option-sets.component';
import { LineOptionSetDialogComponent } from './line-option-set-dialog/line-option-set-dialog.component';
import { LineOptionSetAttachComponent } from './line-option-set-attach/line-option-set-attach.component';
import { LineOptionPickerDialogComponent } from './line-option-picker-dialog/line-option-picker-dialog.component';
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

/**
 * UI-only module so the line option set components can be embedded elsewhere
 * (product/category forms) without registering lazy routes twice.
 */
@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
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
    declarations: [
        LineOptionSetsComponent,
        LineOptionSetDialogComponent,
        LineOptionSetAttachComponent,
        LineOptionPickerDialogComponent
    ],
    exports: [LineOptionSetsComponent, LineOptionSetAttachComponent, LineOptionPickerDialogComponent]
})
export class LineOptionSetsUiModule {}
