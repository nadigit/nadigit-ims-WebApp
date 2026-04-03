import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreditManagementRoutingModule } from './credit-management-routing.module';
import { CreditAccountManagementComponent } from './credit-account-management/credit-account-management.component';
import { CreditManagementDashboardComponent } from './credit-management-dashboard/credit-management-dashboard.component';
import { CreditReportsModule } from './credit-reports/credit-reports.module';
import { CreditBalanceCardComponent } from './shared/credit-balance-card/credit-balance-card.component';
import { IssueCreditModalComponent } from './shared/issue-credit-modal/issue-credit-modal.component';
import { AdjustCreditModalComponent } from './shared/adjust-credit-modal/adjust-credit-modal.component';
import { SetCreditLimitModalComponent } from './shared/set-credit-limit-modal/set-credit-limit-modal.component';

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CalendarModule } from 'primeng/calendar';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { SkeletonModule } from 'primeng/skeleton';
import { TabViewModule } from 'primeng/tabview';
import { DividerModule } from 'primeng/divider';
import { BadgeModule } from 'primeng/badge';
import { InputSwitchModule } from 'primeng/inputswitch';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectButtonModule } from 'primeng/selectbutton';


@NgModule({
  declarations: [
    CreditAccountManagementComponent,
    CreditManagementDashboardComponent,
    CreditBalanceCardComponent,
    IssueCreditModalComponent,
    AdjustCreditModalComponent,
    SetCreditLimitModalComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    CreditReportsModule,
    CreditManagementRoutingModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextareaModule,
    CalendarModule,
    TagModule,
    DropdownModule,
    ToastModule,
    ProgressSpinnerModule,
    TooltipModule,
    CardModule,
    ChartModule,
    TranslateModule,
    SharedModule,
    SkeletonModule,
    TabViewModule,
    DividerModule,
    BadgeModule,
    InputSwitchModule,
    CheckboxModule,
    SelectButtonModule
  ],
  exports: [
    CreditBalanceCardComponent,
    IssueCreditModalComponent,
    AdjustCreditModalComponent,
    SetCreditLimitModalComponent
  ]
})
export class CreditManagementModule { }

