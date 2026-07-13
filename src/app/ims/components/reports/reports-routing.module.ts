import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { LicenseFeatureGuard } from 'src/app/guards/license-feature.guard';
import { ReportsShellComponent } from './reports-shell/reports-shell.component';
import { ReportsDefaultRedirectComponent } from './reports-default-redirect/reports-default-redirect.component';
import { SalesSummaryReportComponent } from './sales-summary-report/sales-summary-report.component';
import { PurchaseSummaryReportComponent } from './purchase-summary-report/purchase-summary-report.component';
import { InventorySnapshotReportComponent } from './inventory-snapshot-report/inventory-snapshot-report.component';
import { ProfitAnalysisReportComponent } from './profit-analysis-report/profit-analysis-report.component';
import { ForecastingReportComponent } from './forecasting-report/forecasting-report.component';
import { ProductMovementReportComponent } from './product-movement-report/product-movement-report.component';
import { TopSellingProductsReportComponent } from './top-selling-products-report/top-selling-products-report.component';
import { VatDeclarationReportComponent } from './vat-declaration-report/vat-declaration-report.component';
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
        canActivate: [AuthGuard, LicenseFeatureGuard],
        data: { roles: ['ADMIN'], licenseFeature: 'REPORTS_AND_ANALYTICS' }
      },
      {
        path: 'purchases',
        component: PurchaseSummaryReportComponent,
        canActivate: [AuthGuard, LicenseFeatureGuard],
        data: { roles: ['ADMIN'], licenseFeature: 'REPORTS_AND_ANALYTICS' }
      },
      {
        path: 'top-products',
        component: TopSellingProductsReportComponent,
        canActivate: [AuthGuard, LicenseFeatureGuard],
        data: { roles: ['ADMIN'], licenseFeature: 'REPORTS_AND_ANALYTICS' }
      },
      {
        path: 'inventory',
        component: InventorySnapshotReportComponent,
        canActivate: [AuthGuard, LicenseFeatureGuard],
        data: { roles: ['ADMIN'], licenseFeature: 'REPORTS_AND_ANALYTICS' }
      },
      {
        path: 'profit',
        component: ProfitAnalysisReportComponent,
        canActivate: [AuthGuard, LicenseFeatureGuard],
        data: { roles: ['ADMIN'], licenseFeature: 'REPORTS_AND_ANALYTICS' }
      },
      {
        path: 'vat',
        component: VatDeclarationReportComponent,
        canActivate: [AuthGuard, LicenseFeatureGuard],
        data: { roles: ['ADMIN', 'ACCOUNTANT'], licenseFeature: 'TAX_RULE_ENGINE' }
      },
      {
        path: 'forecasting',
        component: ForecastingReportComponent,
        canActivate: [AuthGuard, LicenseFeatureGuard],
        data: { roles: ['ADMIN'], licenseFeature: 'AI_FORECASTING' }
      },
      {
        path: 'product-movement',
        component: ProductMovementReportComponent,
        canActivate: [AuthGuard, LicenseFeatureGuard],
        data: { roles: ['ADMIN'], licenseFeature: 'REPORTS_AND_ANALYTICS' }
      },
      {
        path: 'credit',
        component: CreditReportsComponent,
        canActivate: [AuthGuard, LicenseFeatureGuard],
        data: { roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'], licenseFeature: 'REPORTS_AND_ANALYTICS' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReportsRoutingModule {}
