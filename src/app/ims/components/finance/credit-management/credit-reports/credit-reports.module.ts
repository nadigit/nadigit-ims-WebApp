import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { ChartModule } from 'primeng/chart';
import { CreditReportsComponent } from './credit-reports.component';

/**
 * Standalone feature module for credit reports so the same component can be routed
 * under Finance (legacy redirect) and under Reports.
 */
@NgModule({
  declarations: [CreditReportsComponent],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    TableModule,
    ButtonModule,
    ToastModule,
    ProgressSpinnerModule,
    TabViewModule,
    TagModule,
    DropdownModule,
    ChartModule,
  ],
  exports: [CreditReportsComponent],
})
export class CreditReportsModule {}
