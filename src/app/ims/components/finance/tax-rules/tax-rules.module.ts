import { NgModule } from '@angular/core';
import { PageNoteComponent } from 'src/app/shared/page-note';
import { TaxRulesRoutingModule } from './tax-rules-routing.module';
import { TaxRulesUiModule } from './tax-rules-ui.module';

/** Lazy finance route: reuses {@link TaxRulesUiModule} so the same component can be embedded in Settings. */
@NgModule({
    imports: [
    PageNoteComponent,TaxRulesUiModule, TaxRulesRoutingModule]
})
export class TaxRulesModule {}
