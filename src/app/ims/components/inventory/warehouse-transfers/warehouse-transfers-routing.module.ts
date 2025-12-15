import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WarehouseTransfersComponent } from './warehouse-transfers.component';
import { TransferDetailsPageComponent } from './transfer-details-page/transfer-details-page.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: WarehouseTransfersComponent },
        { path: ':id', component: TransferDetailsPageComponent }
    ])],
    exports: [RouterModule]
})
export class WarehouseTransfersRoutingModule { }

