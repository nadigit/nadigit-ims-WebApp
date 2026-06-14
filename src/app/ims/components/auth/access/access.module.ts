import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

import { AccessRoutingModule } from './access-routing.module';
import { AccessComponent } from './access.component';
import { TranslateModule } from '@ngx-translate/core';
import { BrandLogoComponent } from '../../../../shared/brand-logo';

@NgModule({
    imports: [
        CommonModule,
        AccessRoutingModule,
        ButtonModule,
        TranslateModule,
        BrandLogoComponent,
    ],
    declarations: [AccessComponent]
})
export class AccessModule { }
