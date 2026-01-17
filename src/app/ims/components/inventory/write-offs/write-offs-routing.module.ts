import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WriteOffsComponent } from './write-offs.component';
import { WriteOffDetailsPageComponent } from './write-off-details-page/write-off-details-page.component';

import { WriteOffCreateComponent } from './write-off-create/write-off-create.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: WriteOffsComponent },
        { path: 'create', component: WriteOffCreateComponent },
        { path: ':id', component: WriteOffDetailsPageComponent }
    ])],
    exports: [RouterModule]
})
export class WriteOffsRoutingModule { }

