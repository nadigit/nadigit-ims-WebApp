import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { StockMovementsComponent } from './stock-movements.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: StockMovementsComponent }
    ])],
    exports: [RouterModule]
})
export class StockMovementsRoutingModule { }

