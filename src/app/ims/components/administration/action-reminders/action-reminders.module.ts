import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionRemindersRoutingModule } from './action-reminders-routing.module';
import { ActionRemindersComponent } from './action-reminders.component';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ActionRemindersRoutingModule,
    ButtonModule,
    TagModule,
    SelectButtonModule,
    ProgressSpinnerModule,
    ToastModule,
    TranslateModule
  ],
  declarations: [ActionRemindersComponent]
})
export class ActionRemindersModule { }
