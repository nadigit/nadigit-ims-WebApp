import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CreditAccountManagementComponent } from './credit-account-management/credit-account-management.component';
import { CreditManagementDashboardComponent } from './credit-management-dashboard/credit-management-dashboard.component';
import { CreditReportsComponent } from './credit-reports/credit-reports.component';
import { AuthGuard } from 'src/app/guards/auth.guard';

const routes: Routes = [
  {
    path: 'customer/:customerId',
    component: CreditAccountManagementComponent,
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN', 'VENDOR'] }
  },
  {
    path: 'dashboard',
    component: CreditManagementDashboardComponent,
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'reports',
    component: CreditReportsComponent,
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'] }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CreditManagementRoutingModule { }

