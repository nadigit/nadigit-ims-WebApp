import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LicenseCapabilitiesService } from '../../services/license-capabilities.service';
import { LayoutService } from '../../layout/service/app.layout.service';

/**
 * Shown in place of a panel the current plan does not include.
 *
 * Before this, a feature outside the plan announced itself as a failure: the dashboard fired its
 * usual requests, the backend answered 403 FEATURE_NOT_LICENSED, and the user got warning toasts
 * and empty widgets that read as a broken installation rather than as a plan boundary. The call
 * should not be made at all — the console already knows the answer from the capabilities snapshot.
 *
 * The required plan comes from the backend's own tier matrix via
 * {@link LicenseCapabilitiesService.getRequiredTier}, never from a name typed into a template,
 * so repricing a feature does not leave the wrong plan name on screen.
 */
@Component({
  selector: 'app-feature-locked',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="feature-locked" [class.feature-locked--compact]="compact">
      <div class="feature-locked__icon"><i class="pi pi-lock"></i></div>
      <div class="feature-locked__body">
        <div class="feature-locked__title">{{ title || ('feature_locked_title' | translate) }}</div>
        <p class="feature-locked__text">
          <ng-container *ngIf="requiredTier; else noTier">
            {{ 'feature_locked_message' | translate: { plan: requiredTier } }}
          </ng-container>
          <ng-template #noTier>{{ 'feature_locked_message_generic' | translate }}</ng-template>
        </p>
        <a *ngIf="showUpgradeLink" class="feature-locked__link" (click)="openPlanDetails()">
          {{ 'feature_locked_action' | translate }}
        </a>
      </div>
    </div>
  `,
  styles: [`
    .feature-locked {
      display: flex;
      align-items: flex-start;
      gap: .9rem;
      padding: 1.25rem;
      border-radius: 10px;
      border: 1px dashed var(--surface-border, #d8e0ea);
      background: var(--surface-50, #fafbfd);
    }
    .feature-locked--compact { padding: .85rem 1rem; gap: .65rem; }
    .feature-locked__icon {
      display: flex; align-items: center; justify-content: center;
      flex: 0 0 auto; width: 2.25rem; height: 2.25rem; border-radius: 50%;
      background: var(--surface-200, #e6ebf2); color: var(--text-color-secondary, #64748b);
    }
    .feature-locked--compact .feature-locked__icon { width: 1.75rem; height: 1.75rem; font-size: .8rem; }
    .feature-locked__body { min-width: 0; }
    .feature-locked__title { font-weight: 600; color: var(--text-color, #1f2937); margin-bottom: .2rem; }
    .feature-locked__text {
      margin: 0; font-size: .875rem; line-height: 1.5;
      color: var(--text-color-secondary, #64748b);
    }
    .feature-locked__link {
      display: inline-block; margin-top: .6rem; font-size: .875rem; font-weight: 500;
      color: var(--primary-color, #4f46e5); text-decoration: none;
      /* No longer an anchor — it opens System Info in place rather than navigating. */
      cursor: pointer;
    }
    .feature-locked__link:hover { text-decoration: underline; }
  `],
})
export class FeatureLockedComponent implements OnInit {

  /** Backend LicensedFeature name, e.g. 'WRITE_OFFS'. */
  @Input() feature!: string;
  /** Optional override; defaults to a generic "not in your plan" heading. */
  @Input() title?: string;
  @Input() compact = false;
  @Input() showUpgradeLink = true;

  requiredTier: string | null = null;

  constructor(
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    private layoutService: LayoutService,
  ) {}

  /**
   * Opens System Info rather than navigating to My Company.
   *
   * System Info is where the plan, its features and the activation controls actually live, so it
   * answers "what would I get" and "how do I get it" in one place. My Company is the organization's
   * own details and says nothing about the licence — landing there after clicking a plan link left
   * the user to go looking.
   */
  openPlanDetails(): void {
    this.layoutService.triggerSystemInfoLoad();
  }

  ngOnInit(): void {
    this.requiredTier = this.feature
      ? this.licenseCapabilitiesService.getRequiredTier(this.feature)
      : null;
  }
}
