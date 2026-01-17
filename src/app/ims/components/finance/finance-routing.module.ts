import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';

@NgModule({
    imports: [RouterModule.forChild([
        { path: 'expenses', loadChildren: () => import('./expenses/expenses.module').then(m => m.ExpensesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR']} },
        { path: 'payments', loadChildren: () => import('./payments/payments.module').then(m => m.PaymentsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']} },
        { path: 'refunds', loadChildren: () => import('./refunds/refunds.module').then(m => m.RefundsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']} },
        { path: 'purchase-credits', loadChildren: () => import('./purchase-credits/purchase-credits.module').then(m => m.PurchaseCreditsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']} },
        { path: 'financial-documents', loadChildren: () => import('./financial-documents/financial-documents.module').then(m => m.FinancialDocumentsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','ACCOUNTANT','AUDITOR']}},
        { path: 'banking', loadChildren: () => import('./banking/banking.module').then(m => m.BankingModule), canActivate:[AuthGuard], data : { roles:['ADMIN','ACCOUNTANT','AUDITOR']}},
        { path: 'credit-management', loadChildren: () => import('./credit-management/credit-management.module').then(m => m.CreditManagementModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']}},
        { path: '**', redirectTo: '/notfound' }
    ])],
    exports: [RouterModule]
})
export class FinanceRoutingModule { }
