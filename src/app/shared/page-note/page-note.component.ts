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
 * It carries no styles of its own: the look is the shared `.ims-note` in ims-form-sections.scss,
 * which form dialogs use too (as `.ims-form-callout`). A component-private copy is how pages and
 * forms drifted apart in the first place.
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
    <div class="ims-note" [class.ims-note--warning]="tone === 'warning'">
      <i class="pi" [ngClass]="icon || (tone === 'warning' ? 'pi-exclamation-triangle' : 'pi-info-circle')"
         aria-hidden="true"></i>
      <span class="ims-note__text"><ng-content></ng-content></span>
    </div>
  `,
  styles: [`:host { display: block; margin-bottom: 1rem; }`],
})
export class PageNoteComponent {
  @Input() tone: 'info' | 'warning' = 'info';
  /** Override the default icon; the tone picks a sensible one otherwise. */
  @Input() icon?: string;
}
