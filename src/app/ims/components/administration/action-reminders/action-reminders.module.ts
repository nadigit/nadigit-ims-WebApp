import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActionRemindersRoutingModule } from './action-reminders-routing.module';
import { ActionRemindersComponent } from './action-reminders.component';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    ActionRemindersRoutingModule,
    ButtonModule,
    CardModule,
    TagModule,
    ProgressSpinnerModule,
    ToastModule,
    TranslateModule
  ],
  declarations: [ActionRemindersComponent]
})
export class ActionRemindersModule { }
