import { NgModule } from '@angular/core';
import { LinePriceRulesRoutingModule } from './line-price-rules-routing.module';
import { LinePriceRulesUiModule } from './line-price-rules-ui.module';

/** Lazy finance route: reuses {@link LinePriceRulesUiModule} so the same component can be embedded. */
@NgModule({
    imports: [LinePriceRulesUiModule, LinePriceRulesRoutingModule]
})
export class LinePriceRulesModule {}
