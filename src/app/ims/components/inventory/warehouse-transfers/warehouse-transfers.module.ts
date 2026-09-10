import { NgModule } from '@angular/core';
import { PageNoteComponent } from 'src/app/shared/page-note';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehouseTransfersRoutingModule } from './warehouse-transfers-routing.module';
import { WarehouseTransfersComponent } from './warehouse-transfers.component';
import { TransferDetailsPageComponent } from './transfer-details-page/transfer-details-page.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { SharedModule } from 'src/app/shared/shared.module';
import { TabViewModule } from 'primeng/tabview';
import { BadgeModule } from 'primeng/badge';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { ReportingService } from 'src/app/utils/reporting.service';

@NgModule({
    imports: [
    PageNoteComponent,
        CommonModule,
        WarehouseTransfersRoutingModule,
        TableModule,
        FormsModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        ToolbarModule,
        InputTextModule,
        InputTextareaModule,
        DropdownModule,
        AutoCompleteModule,
        InputNumberModule,
        DialogModule,
        TranslateModule,
        ProgressSpinnerModule,
        CalendarModule,
        TooltipModule,
        TagModule,
        TimelineModule,
        CardModule,
        SharedModule,
        TabViewModule,
        BadgeModule,
        DividerModule,
        MessageModule
    ],
    declarations: [WarehouseTransfersComponent, TransferDetailsPageComponent],
    providers: [ReportingService],
})
export class WarehouseTransfersModule { }

