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
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CreditReportsModule } from '../finance/credit-management/credit-reports/credit-reports.module';
import { ReportsRoutingModule } from './reports-routing.module';
import { ReportsShellComponent } from './reports-shell/reports-shell.component';
import { ReportsDefaultRedirectComponent } from './reports-default-redirect/reports-default-redirect.component';
import { SalesSummaryReportComponent } from './sales-summary-report/sales-summary-report.component';
import { PurchaseSummaryReportComponent } from './purchase-summary-report/purchase-summary-report.component';
import { InventorySnapshotReportComponent } from './inventory-snapshot-report/inventory-snapshot-report.component';
import { ProfitAnalysisReportComponent } from './profit-analysis-report/profit-analysis-report.component';
import { ForecastingReportComponent } from './forecasting-report/forecasting-report.component';

@NgModule({
  declarations: [
    ReportsShellComponent,
    ReportsDefaultRedirectComponent,
    SalesSummaryReportComponent,
    PurchaseSummaryReportComponent,
    InventorySnapshotReportComponent,
    ProfitAnalysisReportComponent,
    ForecastingReportComponent
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
    InputSwitchModule,
    InputTextModule,
    TableModule,
    TagModule,
    TooltipModule,
    CreditReportsModule,
    ReportsRoutingModule
  ]
})
export class ReportsModule {}
