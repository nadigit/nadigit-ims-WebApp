import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { AuthGuard } from 'src/app/guards/auth.guard';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: DashboardComponent, canActivate:[AuthGuard], data : { roles:['ADMIN', 'USER']} }
    ])],
    exports: [RouterModule]
})
export class DashboardsRoutingModule { }
