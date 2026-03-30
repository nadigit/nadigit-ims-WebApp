import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WriteOffsRoutingModule } from './write-offs-routing.module';
import { WriteOffsComponent } from './write-offs.component';
import { WriteOffDetailsPageComponent } from './write-off-details-page/write-off-details-page.component';
import { WriteOffCreateComponent } from './write-off-create/write-off-create.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { SharedModule } from 'src/app/shared/shared.module';
import { TabViewModule } from 'primeng/tabview';
import { BadgeModule } from 'primeng/badge';
import { DividerModule } from 'primeng/divider';
import { TranslateModule } from '@ngx-translate/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ReactiveFormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageModule } from 'primeng/message';
import { ReportingService } from 'src/app/utils/reporting.service';
@NgModule({
    imports: [
        CommonModule,
        WriteOffsRoutingModule,
        TableModule,
        FormsModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        InputTextModule,
        InputTextareaModule,
        DropdownModule,
        CalendarModule,
        TooltipModule,
        TagModule,
        TimelineModule,
        CardModule,
        SharedModule,
        TabViewModule,
        BadgeModule,
        DividerModule,
        TranslateModule,
        ProgressSpinnerModule,
        DialogModule,
        ConfirmDialogModule,
        ReactiveFormsModule,
        InputNumberModule,
        AutoCompleteModule,
        MessageModule
    ],
    declarations: [WriteOffsComponent, WriteOffDetailsPageComponent, WriteOffCreateComponent],
    providers: [ConfirmationService, ReportingService]
})
export class WriteOffsModule { }

