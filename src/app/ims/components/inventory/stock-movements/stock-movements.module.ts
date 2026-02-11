import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockMovementsRoutingModule } from './stock-movements-routing.module';
import { StockMovementsComponent } from './stock-movements.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { SharedModule } from 'src/app/shared/shared.module';
import { ReportingService } from 'src/app/utils/reporting.service';
@NgModule({
    imports: [
        CommonModule,
        StockMovementsRoutingModule,
        TableModule,
        FormsModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        InputTextModule,
        DropdownModule,
        DialogModule,
        TranslateModule,
        ProgressSpinnerModule,
        CalendarModule,
        TooltipModule,
        TagModule,
        CardModule,
        SharedModule
    ],
    declarations: [StockMovementsComponent],
    providers: [ReportingService]
})
export class StockMovementsModule { }

