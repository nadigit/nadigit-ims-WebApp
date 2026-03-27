import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationsRoutingModule } from './notifications-routing.module';
import { NotificationsComponent } from './notifications.component';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    NotificationsRoutingModule,
    FormsModule,
    ButtonModule,
    RippleModule,
    ToastModule,
    CardModule,
    InputTextModule,
    DropdownModule,
    SelectButtonModule,
    TagModule,
    BadgeModule,
    ProgressSpinnerModule,
    TooltipModule,
    TranslateModule
  ],
  declarations: [NotificationsComponent]
})
export class NotificationsModule { }
