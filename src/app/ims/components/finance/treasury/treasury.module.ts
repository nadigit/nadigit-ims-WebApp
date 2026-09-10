import { NgModule } from '@angular/core';
import { PageNoteComponent } from 'src/app/shared/page-note';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TreasuryRoutingModule } from './treasury-routing.module';
import { CashRegistersListComponent } from './cash-registers/cash-registers-list.component';
import { CashRegisterDetailsComponent } from './cash-registers/cash-register-details.component';
import { TreasuryOverviewComponent } from './treasury-overview/treasury-overview.component';
import { CashRegisterSessionModule } from '../../cash-register/cash-register-session/cash-register-session.module';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslateModule } from '@ngx-translate/core';
import { TabViewModule } from 'primeng/tabview';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ReportingService } from 'src/app/utils/reporting.service';

@NgModule({
  imports: [
    PageNoteComponent,
    CommonModule,
    FormsModule,
    TreasuryRoutingModule,
    CashRegisterSessionModule,
    TableModule,
    ButtonModule,
    RippleModule,
    ToastModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    DialogModule,
    CalendarModule,
    TagModule,
    SelectButtonModule,
    InputNumberModule,
    TooltipModule,
    ProgressSpinnerModule,
    TranslateModule,
    TabViewModule,
    CardModule,
  ],
  declarations: [
    TreasuryOverviewComponent,
    CashRegistersListComponent,
    CashRegisterDetailsComponent,
  ],
  providers: [ReportingService],
})
export class TreasuryModule { }
