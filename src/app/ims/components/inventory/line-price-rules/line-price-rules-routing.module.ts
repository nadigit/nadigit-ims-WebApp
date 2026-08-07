import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { LinePriceRulesComponent } from './line-price-rules.component';

@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        component: LinePriceRulesComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ADMIN', 'WAREHOUSEMAN', 'VENDOR', 'ACCOUNTANT', 'AUDITOR'] }
      }
    ])
  ],
  exports: [RouterModule]
})
export class LinePriceRulesRoutingModule {}
