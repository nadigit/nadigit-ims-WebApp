import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { LicenseFeatureGuard } from 'src/app/guards/license-feature.guard';

@NgModule({
    imports: [RouterModule.forChild([
        { path: 'expenses', loadChildren: () => import('./expenses/expenses.module').then(m => m.ExpensesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR']} },
        { path: 'payments', loadChildren: () => import('./payments/payments.module').then(m => m.PaymentsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']} },
        { path: 'refunds', loadChildren: () => import('./refunds/refunds.module').then(m => m.RefundsModule), canActivate:[AuthGuard, LicenseFeatureGuard], data : { roles:['ADMIN','VENDOR'], licenseFeature: 'REFUNDS'} },
        { path: 'purchase-credits', loadChildren: () => import('./purchase-credits/purchase-credits.module').then(m => m.PurchaseCreditsModule), canActivate:[AuthGuard, LicenseFeatureGuard], data : { roles:['ADMIN','VENDOR'], licenseFeature: 'PURCHASE_CREDITS'} },
        { path: 'financial-documents', loadChildren: () => import('./financial-documents/financial-documents.module').then(m => m.FinancialDocumentsModule), canActivate:[AuthGuard, LicenseFeatureGuard], data : { roles:['ADMIN','ACCOUNTANT','AUDITOR'], licenseFeature: 'FINANCIAL_DOCUMENTS'}},
        { path: 'banking', loadChildren: () => import('./banking/banking.module').then(m => m.BankingModule), canActivate:[AuthGuard, LicenseFeatureGuard], data : { roles:['ADMIN','ACCOUNTANT','AUDITOR'], licenseFeature: 'BANK_ACCOUNTS'}},
        { path: 'credit-management', loadChildren: () => import('./credit-management/credit-management.module').then(m => m.CreditManagementModule), canActivate:[AuthGuard, LicenseFeatureGuard], data : { roles:['ADMIN','VENDOR'], licenseFeature: 'CUSTOMER_CREDITS'}},
        { path: 'treasury', loadChildren: () => import('./treasury/treasury.module').then(m => m.TreasuryModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR','ACCOUNTANT','AUDITOR']} },
        { path: 'tax-rules', loadChildren: () => import('./tax-rules/tax-rules.module').then(m => m.TaxRulesModule), canActivate:[AuthGuard, LicenseFeatureGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR','ACCOUNTANT','AUDITOR'], licenseFeature: 'TAX_RULE_ENGINE'}},
        { path: '**', redirectTo: '/notfound' }
    ])],
    exports: [RouterModule]
})
export class FinanceRoutingModule { }
