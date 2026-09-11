import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';

/**
 * The "create one now" shortcut beside a field that picks an existing record — a new customer from
 * the order form, a new category from the product form.
 *
 * One control, one look. The product form had a round + icon; orders and purchases had text links
 * ("Add new customer") styled by a private class copied between the two components. Same action,
 * two appearances, and each new form picked whichever it was copied from.
 *
 * The label is the tooltip and the accessible name, so the icon never stands alone for screen readers.
 * Place it in the field head, after the <label>: `.ims-form-field-head` spaces the two apart.
 */
@Component({
  selector: 'app-form-add-button',
  standalone: true,
  imports: [ButtonModule, RippleModule, TooltipModule],
  template: `
    <button type="button" pButton pRipple icon="pi pi-plus"
      class="p-button-rounded p-button-text p-button-sm ims-form-add-btn"
      [disabled]="disabled"
      [pTooltip]="label" tooltipPosition="top"
      [attr.aria-label]="label"
      (click)="add.emit()"></button>
  `,
  styles: [`:host { display: inline-flex; flex-shrink: 0; }`],
})
export class FormAddButtonComponent {
  /** What gets created, e.g. the translation of 'add_new_customer'. */
  @Input() label = '';
  @Input() disabled = false;
  @Output() add = new EventEmitter<void>();
}
