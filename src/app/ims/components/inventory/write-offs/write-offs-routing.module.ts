import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WriteOffsComponent } from './write-offs.component';
import { WriteOffDetailsPageComponent } from './write-off-details-page/write-off-details-page.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: WriteOffsComponent },
        { path: ':id', component: WriteOffDetailsPageComponent }
    ])],
    exports: [RouterModule]
})
export class WriteOffsRoutingModule { }

