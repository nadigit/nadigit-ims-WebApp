import { NgModule } from '@angular/core';
import { LineOptionSetsRoutingModule } from './line-option-sets-routing.module';
import { LineOptionSetsUiModule } from './line-option-sets-ui.module';

/** Lazy finance route: reuses {@link LineOptionSetsUiModule} so the same components can be embedded elsewhere. */
@NgModule({
    imports: [LineOptionSetsUiModule, LineOptionSetsRoutingModule]
})
export class LineOptionSetsModule {}
