import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { ChartModule } from 'primeng/chart';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { CreditReportsModule } from '../finance/credit-management/credit-reports/credit-reports.module';
import { ReportsRoutingModule } from './reports-routing.module';
import { ReportsShellComponent } from './reports-shell/reports-shell.component';
import { ReportsDefaultRedirectComponent } from './reports-default-redirect/reports-default-redirect.component';
import { SalesSummaryReportComponent } from './sales-summary-report/sales-summary-report.component';
import { PurchaseSummaryReportComponent } from './purchase-summary-report/purchase-summary-report.component';
import { InventorySnapshotReportComponent } from './inventory-snapshot-report/inventory-snapshot-report.component';
import { ProfitAnalysisReportComponent } from './profit-analysis-report/profit-analysis-report.component';

@NgModule({
  declarations: [
    ReportsShellComponent,
    ReportsDefaultRedirectComponent,
    SalesSummaryReportComponent,
    PurchaseSummaryReportComponent,
    InventorySnapshotReportComponent,
    ProfitAnalysisReportComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    CardModule,
    DropdownModule,
    ChartModule,
    ProgressSpinnerModule,
    MessageModule,
    ButtonModule,
    InputNumberModule,
    CreditReportsModule,
    ReportsRoutingModule
  ]
})
export class ReportsModule {}
