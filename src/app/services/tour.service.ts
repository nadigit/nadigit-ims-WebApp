import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { driver, Driver, DriveStep } from 'driver.js';
import { withIllustration } from './tour-illustrations';

/**
 * Identifiers for the guided tours available across the app.
 * Add new tours here as more pages get their own walkthroughs.
 */
export type TourId = 'welcome';

/**
 * Drives in-app guided tours (driver.js) and tracks per-user completion.
 *
 * Persistence is per-user via localStorage (same convention as the dashboard
 * "Getting Started" card), so each Keycloak user sees a first-login tour once.
 * Tours can always be replayed from the topbar help menu via {@link startWelcomeTour}.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private static readonly STORAGE_PREFIX = 'ims_tour_seen';
  private cachedUsername: string | null = null;
  private activeDriver: Driver | null = null;

  constructor(
    private translate: TranslateService,
    private keycloakService: KeycloakService,
  ) {}

  /** Resolve the current username for per-user persistence (cached). */
  private async getUsername(): Promise<string> {
    if (this.cachedUsername) {
      return this.cachedUsername;
    }
    try {
      const profile = await this.keycloakService.loadUserProfile();
      this.cachedUsername = profile.username || profile.id || 'default';
    } catch {
      this.cachedUsername = 'default';
    }
    return this.cachedUsername;
  }

  private storageKey(tourId: TourId, username: string): string {
    return `${TourService.STORAGE_PREFIX}_${tourId}_${username}`;
  }

  /** True when this user has already finished/dismissed the given tour. */
  async hasSeen(tourId: TourId): Promise<boolean> {
    const username = await this.getUsername();
    return localStorage.getItem(this.storageKey(tourId, username)) === 'true';
  }

  private async markSeen(tourId: TourId): Promise<void> {
    const username = await this.getUsername();
    localStorage.setItem(this.storageKey(tourId, username), 'true');
  }

  /** Clear completion state so the tour will auto-launch again (useful for QA/support). */
  async resetTour(tourId: TourId): Promise<void> {
    const username = await this.getUsername();
    localStorage.removeItem(this.storageKey(tourId, username));
  }

  /**
   * Launch the welcome tour automatically the first time a user signs in.
   * No-op if already seen, if a tour is already running, or if none of the
   * tour targets are on screen yet (e.g. the cashier-only POS layout).
   */
  async maybeStartWelcomeTour(): Promise<void> {
    if (this.activeDriver) {
      return;
    }
    if (await this.hasSeen('welcome')) {
      return;
    }
    // Give the dashboard a moment to render its anchors before highlighting.
    setTimeout(() => this.startWelcomeTour(false), 800);
  }

  /**
   * Start (or replay) the welcome tour.
   * @param force when true, runs even if already seen (used by the "Take a tour" menu action).
   */
  async startWelcomeTour(force = true): Promise<void> {
    if (this.activeDriver) {
      return;
    }
    if (!force && (await this.hasSeen('welcome'))) {
      return;
    }

    const steps = this.buildWelcomeSteps();
    if (steps.length === 0) {
      // Nothing on screen to highlight (e.g. POS-only view) — mark as seen and bail.
      await this.markSeen('welcome');
      return;
    }

    this.activeDriver = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: 'ims-tour-popover',
      nextBtnText: this.translate.instant('tour_next'),
      prevBtnText: this.translate.instant('tour_prev'),
      doneBtnText: this.translate.instant('tour_done'),
      progressText: this.translate.instant('tour_progress'),
      steps,
      onDestroyed: () => {
        // Fires whether the user finished or dismissed — record it either way.
        void this.markSeen('welcome');
        this.activeDriver = null;
      },
    });

    this.activeDriver.drive();
  }

  /**
   * Build the welcome-tour steps, keeping only those whose target is currently
   * in the DOM. Steps without an `element` are centered modals and always shown.
   */
  private buildWelcomeSteps(): DriveStep[] {
    const t = (key: string) => this.translate.instant(key);

    const candidates: DriveStep[] = [
      {
        popover: {
          title: t('tour_welcome_title'),
          description: withIllustration('welcome', t('tour_welcome_desc')),
        },
      },
      {
        element: '.layout-menu',
        popover: {
          title: t('tour_menu_title'),
          description: withIllustration('menu', t('tour_menu_desc')),
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '.getting-started-banner',
        popover: {
          title: t('tour_getting_started_title'),
          description: withIllustration('gettingStarted', t('tour_getting_started_desc')),
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '.notification-button',
        popover: {
          title: t('tour_notifications_title'),
          description: withIllustration('notifications', t('tour_notifications_desc')),
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '.action-reminders-button',
        popover: {
          title: t('tour_reminders_title'),
          description: withIllustration('reminders', t('tour_reminders_desc')),
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '.copilot-topbar-button',
        popover: {
          title: t('tour_copilot_title'),
          description: withIllustration('copilot', t('tour_copilot_desc')),
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="settings-menu"]',
        popover: {
          title: t('tour_settings_title'),
          description: withIllustration('settings', t('tour_settings_desc')),
          side: 'bottom',
          align: 'end',
        },
      },
      {
        popover: {
          title: t('tour_finish_title'),
          description: withIllustration('finish', t('tour_finish_desc')),
        },
      },
    ];

    return candidates.filter((step) => {
      const selector = typeof step.element === 'string' ? step.element : null;
      // Centered modal steps (no element) always qualify; element steps must resolve.
      return !selector || document.querySelector(selector) !== null;
    });
  }
}
