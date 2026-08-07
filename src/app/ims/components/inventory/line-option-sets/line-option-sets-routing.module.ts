import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { LineOptionSetsComponent } from './line-option-sets.component';

@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        component: LineOptionSetsComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ADMIN', 'WAREHOUSEMAN', 'VENDOR', 'ACCOUNTANT', 'AUDITOR'] }
      }
    ])
  ],
  exports: [RouterModule]
})
export class LineOptionSetsRoutingModule {}
