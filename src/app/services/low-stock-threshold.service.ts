import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppConfigurationService } from './app-configuration.service';
import { getLowStockThreshold } from '../shared/product-utils';

/**
 * Single, app-wide source for the configured low-stock threshold.
 *
 * Loads the value once (and refreshes when the configuration changes) so every
 * product-quantity badge across the app classifies "low stock" the same way —
 * instead of each page passing (or forgetting to pass) its own threshold.
 */
@Injectable({ providedIn: 'root' })
export class LowStockThresholdService {
  private readonly subject = new BehaviorSubject<number>(10);
  /** Emits the current low-stock threshold (defaults to 10 until loaded). */
  readonly threshold$ = this.subject.asObservable();
  private loaded = false;

  constructor(private configService: AppConfigurationService) {}

  /** The latest known threshold (synchronous access for templates/getters). */
  get value(): number {
    return this.subject.value;
  }

  /** Triggers the one-time load (and live refresh) the first time it's needed. */
  ensureLoaded(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.reload();
    this.configService.configurationSaved$?.subscribe((key: any) => {
      if (key === 'lowStockThreshold') {
        this.reload();
      }
    });
  }

  private reload(): void {
    getLowStockThreshold(this.configService)
      .then((v) => this.subject.next(v ?? 10))
      .catch(() => this.subject.next(10));
  }
}
