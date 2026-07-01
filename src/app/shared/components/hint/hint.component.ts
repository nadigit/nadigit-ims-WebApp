import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { OverlayPanelModule } from 'primeng/overlaypanel';

/**
 * Inline contextual hint: a small info icon that reveals a short explanation
 * on click. Use next to labels, headers or actions that benefit from a nudge.
 *
 * Usage:
 *   <app-hint text="{{ 'products_avg_margin_hint' | translate }}"></app-hint>
 *   <app-hint [text]="'...'" [title]="'...'" icon="pi pi-info-circle"></app-hint>
 *
 * `text`/`title` are rendered as-is, so translate at the call site.
 */
@Component({
  selector: 'app-hint',
  standalone: true,
  imports: [CommonModule, TranslateModule, OverlayPanelModule],
  template: `
    <button
      type="button"
      class="ims-hint-trigger p-link"
      [attr.aria-label]="ariaLabel || (title || text)"
      (click)="op.toggle($event)"
      (keydown.enter)="op.toggle($event)">
      <i [class]="icon" aria-hidden="true"></i>
    </button>
    <p-overlayPanel #op [showCloseIcon]="false" styleClass="ims-hint-panel" appendTo="body">
      <div class="ims-hint-content">
        <h4 *ngIf="title" class="ims-hint-title">{{ title }}</h4>
        <p class="ims-hint-text">{{ text }}</p>
      </div>
    </p-overlayPanel>
  `,
  styles: [`
    .ims-hint-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--text-color-secondary, #6b7280);
      transition: color 0.15s ease;
      vertical-align: middle;
    }
    .ims-hint-trigger:hover,
    .ims-hint-trigger:focus-visible {
      color: var(--primary-color, #3b82f6);
    }
    .ims-hint-trigger i { font-size: 0.95rem; line-height: 1; }
  `],
})
export class HintComponent {
  /** Main hint text (already translated). */
  @Input() text = '';
  /** Optional bold heading above the text. */
  @Input() title?: string;
  /** PrimeIcons class for the trigger. */
  @Input() icon = 'pi pi-question-circle';
  /** Accessible label for the trigger button. */
  @Input() ariaLabel?: string;
}
