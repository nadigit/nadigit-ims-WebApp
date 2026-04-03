import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { ReportsShellComponent } from './reports-shell/reports-shell.component';
import { ReportsDefaultRedirectComponent } from './reports-default-redirect/reports-default-redirect.component';
import { SalesSummaryReportComponent } from './sales-summary-report/sales-summary-report.component';
import { PurchaseSummaryReportComponent } from './purchase-summary-report/purchase-summary-report.component';
import { InventorySnapshotReportComponent } from './inventory-snapshot-report/inventory-snapshot-report.component';
import { ProfitAnalysisReportComponent } from './profit-analysis-report/profit-analysis-report.component';
import { CreditReportsComponent } from '../finance/credit-management/credit-reports/credit-reports.component';

const routes: Routes = [
  {
    path: '',
    component: ReportsShellComponent,
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'] },
    children: [
      { path: '', pathMatch: 'full', component: ReportsDefaultRedirectComponent },
      {
        path: 'sales',
        component: SalesSummaryReportComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'purchases',
        component: PurchaseSummaryReportComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'inventory',
        component: InventorySnapshotReportComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'profit',
        component: ProfitAnalysisReportComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'credit',
        component: CreditReportsComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'] }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReportsRoutingModule {}
