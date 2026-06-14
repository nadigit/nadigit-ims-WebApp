import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TreasuryOverviewComponent } from './treasury-overview/treasury-overview.component';
import { CashRegistersListComponent } from './cash-registers/cash-registers-list.component';
import { CashRegisterDetailsComponent } from './cash-registers/cash-register-details.component';

@NgModule({
  imports: [RouterModule.forChild([
    { path: '', component: TreasuryOverviewComponent },
    { path: 'cash-registers', component: CashRegistersListComponent },
    { path: 'cash-registers/:shopId', component: CashRegisterDetailsComponent },
  ])],
  exports: [RouterModule]
})
export class TreasuryRoutingModule { }
