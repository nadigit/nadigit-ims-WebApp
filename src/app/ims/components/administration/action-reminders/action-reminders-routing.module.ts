import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ActionRemindersComponent } from './action-reminders.component';

@NgModule({
  imports: [RouterModule.forChild([
    { path: '', component: ActionRemindersComponent }
  ])],
  exports: [RouterModule]
})
export class ActionRemindersRoutingModule { }
