import { Component, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';

/**
 * A field's explanation, on demand: a small icon beside the label that reveals the text on hover,
 * keyboard focus or tap.
 *
 * Forms had accumulated a line of grey help text under nearly every field — what a costing method
 * inherits, why a quantity cannot be edited, what a service is — so the product form read as a wall
 * of prose with the inputs lost in it. The text is still there for whoever needs it, and out of the
 * way of whoever doesn't.
 *
 * Not for everything below a field: validation errors and live values (the VAT rate actually
 * applied, a suggested cost) stay visible, because the user needs them without asking.
 *
 * Usable inside a <label>: clicks are swallowed so tapping the icon opens the help instead of moving
 * focus to the input, which would close it again.
 */
@Component({
  selector: 'app-field-help',
  standalone: true,
  imports: [CommonModule, TooltipModule],
  template: `
    <i class="pi field-help"
       [ngClass]="[iconClass, tone === 'warn' ? 'field-help--warn' : '']"
       [pTooltip]="text"
       [tooltipPosition]="position"
       tooltipEvent="both"
       [showDelay]="120"
       tooltipStyleClass="field-help-tooltip"
       tabindex="0"
       role="button"
       [attr.aria-label]="ariaLabel || (isString ? text : null)"
       (click)="$event.preventDefault(); $event.stopPropagation()"></i>
  `,
  styles: [`
    :host { display: inline-flex; vertical-align: middle; }
    .field-help {
      margin-left: .35rem;
      font-size: .8rem;
      line-height: 1;
      color: var(--text-color-secondary, #64748b);
      opacity: .75;
      cursor: help;
      border-radius: 50%;
      transition: opacity .15s ease, color .15s ease;
    }
    .field-help:hover, .field-help:focus-visible { opacity: 1; color: var(--primary-color, #4f46e5); }
    .field-help:focus-visible { outline: 2px solid var(--primary-color, #4f46e5); outline-offset: 2px; }
    .field-help--warn { color: var(--orange-600, #ea580c); opacity: .9; }
    .field-help--warn:hover, .field-help--warn:focus-visible { color: var(--orange-700, #c2410c); }
  `],
})
export class FieldHelpComponent {
  /** The explanation: translated text, or a template for structured content such as a list. */
  @Input() text: string | TemplateRef<HTMLElement> | null | undefined;
  /** `info` explains; `warn` flags a restriction the user may trip over (a locked field, a profile rule). */
  @Input() tone: 'info' | 'warn' = 'info';
  /** `lock` for "why can't I edit this"; `info` otherwise. */
  @Input() icon: 'info' | 'lock' = 'info';
  @Input() position: 'top' | 'right' | 'bottom' | 'left' = 'top';
  /** Required when `text` is a template, so screen readers still get a name. */
  @Input() ariaLabel?: string;

  get iconClass(): string {
    return this.icon === 'lock' ? 'pi-lock' : 'pi-info-circle';
  }

  get isString(): boolean {
    return typeof this.text === 'string';
  }
}
