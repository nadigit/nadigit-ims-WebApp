import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorRoutingModule } from './error-routing.module';
import { ErrorComponent } from './error.component';
import { ButtonModule } from 'primeng/button';
import { TranslateModule } from '@ngx-translate/core';
import { BrandLogoComponent } from '../../../../shared/brand-logo';

@NgModule({
    imports: [
        CommonModule,
        ErrorRoutingModule,
        ButtonModule,
        TranslateModule,
        BrandLogoComponent,
    ],
    declarations: [ErrorComponent]
})
export class ErrorModule { }
