import { NgModule } from '@angular/core';
import { LinePriceRulesRoutingModule } from './line-price-rules-routing.module';
import { LinePriceRulesUiModule } from './line-price-rules-ui.module';

/** Lazy inventory route for managing conditional line price adjustment rules. */
@NgModule({
  imports: [LinePriceRulesUiModule, LinePriceRulesRoutingModule]
})
export class LinePriceRulesModule {}
