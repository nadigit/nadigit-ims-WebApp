import { NgModule } from '@angular/core';
import { LineOptionSetsRoutingModule } from './line-option-sets-routing.module';
import { LineOptionSetsUiModule } from './line-option-sets-ui.module';

/** Lazy inventory route for managing sale-line option sets ("components"). */
@NgModule({
  imports: [LineOptionSetsUiModule, LineOptionSetsRoutingModule]
})
export class LineOptionSetsModule {}
