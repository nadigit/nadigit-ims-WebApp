import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BankingRoutingModule } from './banking-routing.module';
import { AccountsComponent } from './accounts/accounts.component';
import { AccountDetailsComponent } from './account-details/account-details.component';
import { TransactionFormDialogComponent } from './transactions/transaction-form-dialog/transaction-form-dialog.component';
import { ReconciliationComponent } from './reconciliation/reconciliation.component';

// PrimeNG Modules
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
import { CheckboxModule } from 'primeng/checkbox';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslateModule } from '@ngx-translate/core';
import { TabViewModule } from 'primeng/tabview';
import { BadgeModule } from 'primeng/badge';
import { DividerModule } from 'primeng/divider';
import { InputNumberModule } from 'primeng/inputnumber';

@NgModule({
  imports: [
    CommonModule,
    BankingRoutingModule,
    FormsModule,
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
    CheckboxModule,
    SelectButtonModule,
    TooltipModule,
    ProgressSpinnerModule,
    TranslateModule,
    TabViewModule,
    BadgeModule,
    DividerModule,
    InputNumberModule
  ],
  declarations: [
    AccountsComponent,
    AccountDetailsComponent,
    TransactionFormDialogComponent,
    ReconciliationComponent
  ]
})
export class BankingModule { }

