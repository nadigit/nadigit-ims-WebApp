import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * The standing note at the top of a page: "this is switched off", "this happens automatically",
 * "you are read-only here".
 *
 * Every page had grown its own. Warehouse transfers used neutral utility classes; line price rules
 * and tax rules each had a private amber `*-banner` class with its own colour values and its own
 * dark-mode block; line options wrote a bare paragraph. Same purpose, four appearances, and the
 * next page would have invented a fifth.
 *
 * Two tones, because the meanings differ and flattening them would lose information: `info` states
 * how something behaves, `warning` says something is inert or restricted and the user's work may
 * not do what they expect.
 *
 * Text is projected, so callers keep their own translate pipes and interpolation.
 */
@Component({
  selector: 'app-page-note',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-note" [class.page-note--warning]="tone === 'warning'">
      <i class="pi" [ngClass]="icon || (tone === 'warning' ? 'pi-exclamation-triangle' : 'pi-info-circle')"
         aria-hidden="true"></i>
      <span class="page-note__text"><ng-content></ng-content></span>
    </div>
  `,
  styles: [`
    .page-note {
      display: flex;
      align-items: flex-start;
      gap: .55rem;
      margin-bottom: 1.5rem;
      padding: .75rem 1rem;
      border-radius: 6px;
      border: 1px solid var(--surface-border, #dfe7ef);
      background: var(--surface-ground, #f4f7fb);
      color: var(--text-color-secondary, #64748b);
      font-size: .875rem;
      line-height: 1.5;
    }
    .page-note > .pi { margin-top: .15rem; flex: 0 0 auto; }
    .page-note__text { min-width: 0; }

    .page-note--warning {
      border-color: var(--yellow-200, #fde68a);
      background: var(--yellow-50, #fffbeb);
      color: var(--yellow-900, #78350f);
    }

    :host-context(.layout-theme-dark) .page-note--warning,
    :host-context([data-theme="dark"]) .page-note--warning {
      border-color: rgba(253, 230, 138, .35);
      background: rgba(120, 53, 15, .25);
      color: var(--yellow-200, #fde68a);
    }
  `],
})
export class PageNoteComponent {
  @Input() tone: 'info' | 'warning' = 'info';
  /** Override the default icon; the tone picks a sensible one otherwise. */
  @Input() icon?: string;
}
