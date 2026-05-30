import { NgModule } from '@angular/core';
import { TaxRulesRoutingModule } from './tax-rules-routing.module';
import { TaxRulesUiModule } from './tax-rules-ui.module';

/** Lazy finance route: reuses {@link TaxRulesUiModule} so the same component can be embedded in Settings. */
@NgModule({
    imports: [TaxRulesUiModule, TaxRulesRoutingModule]
})
export class TaxRulesModule {}
