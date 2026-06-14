import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AccountsComponent } from './accounts/accounts.component';
import { AccountDetailsComponent } from './account-details/account-details.component';
import { ReconciliationComponent } from './reconciliation/reconciliation.component';

@NgModule({
  imports: [RouterModule.forChild([
    { path: 'accounts', component: AccountsComponent },
    { path: 'accounts/:id', component: AccountDetailsComponent },
    { path: 'accounts/:accountId/reconcile', component: ReconciliationComponent },
    { path: '', redirectTo: 'accounts', pathMatch: 'full' }
  ])],
  exports: [RouterModule]
})
export class BankingRoutingModule { }

