import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { LayoutService } from '../../layout/service/app.layout.service';
import {
  BRAND_ASSETS,
  brandLogoForScheme,
  brandSecondaryLogoForScheme,
} from '../../utils/brand-assets';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule],
  template: `<img [src]="src" [alt]="alt" [class]="imgClass" [attr.height]="heightAttr" />`,
})
export class BrandLogoComponent implements OnInit, OnDestroy {
  /** `auto` follows app light/dark theme; `light` / `dark` force a variant. */
  @Input() variant: 'auto' | 'light' | 'dark' = 'auto';
  /** `primary` = full marketing logo; `secondary` = compact wordmark (top bar, footer). */
  @Input() mark: 'primary' | 'secondary' = 'primary';
  @Input() alt = 'Nadigit IMS';
  @Input() imgClass = '';
  @Input() height?: string | number;

  src: string = BRAND_ASSETS.logoLight;
  private themeSub?: Subscription;

  constructor(private layoutService: LayoutService) {}

  ngOnInit(): void {
    this.refreshSrc();
    if (this.variant === 'auto') {
      this.themeSub = this.layoutService.configUpdate$.subscribe(() => this.refreshSrc());
    }
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

  get heightAttr(): string | null {
    return this.height != null ? String(this.height) : null;
  }

  private refreshSrc(): void {
    if (this.variant === 'light') {
      this.src = this.logoForScheme('light');
      return;
    }
    if (this.variant === 'dark') {
      this.src = this.logoForScheme('dark');
      return;
    }
    const scheme = this.layoutService.config().colorScheme
      ?? document.documentElement.getAttribute('color-scheme')
      ?? 'light';
    this.src = this.logoForScheme(scheme === 'dark' ? 'dark' : 'light');
  }

  private logoForScheme(scheme: 'light' | 'dark'): string {
    return this.mark === 'secondary'
      ? brandSecondaryLogoForScheme(scheme)
      : brandLogoForScheme(scheme);
  }
}
