import { Component, Input } from '@angular/core';

export type KpiTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'cyan'
  | 'primary'
  | 'teal'
  | 'orange'
  | 'purple'
  | 'success'
  | 'danger'
  | 'pink';

/**
 * Presentational KPI tile for the admin command center: label, value, icon, an optional
 * period-over-period delta, and an optional tiny SVG sparkline. Stateless — the parent passes a
 * pre-formatted {@link value} string and a raw {@link deltaPercent}; the card only renders.
 */
@Component({
  selector: 'app-kpi-card',
  templateUrl: './kpi-card.component.html',
  styleUrls: ['./kpi-card.component.scss'],
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() icon = 'pi pi-chart-bar';
  @Input() tone: KpiTone = 'primary';

  /** Period-over-period change as a percentage. null/undefined hides the delta row. */
  @Input() deltaPercent: number | null | undefined = null;
  /** When true, a positive delta is shown green / negative red. When false the colors invert
   * (e.g. for "payables" or "out of stock" where up is bad). */
  @Input() higherIsBetter = true;
  /** Optional caption shown on the bottom row instead of/alongside the delta. */
  @Input() footnote?: string;

  /** Optional raw series for the sparkline (oldest → newest). */
  @Input() sparkline: number[] | null | undefined = null;

  /** Magnitude beyond which a delta is shown as ">±N%" rather than a noisy exact figure. */
  readonly deltaCap = 999;

  get hasDelta(): boolean {
    return this.deltaPercent !== null && this.deltaPercent !== undefined && isFinite(this.deltaPercent);
  }

  /** Human-friendly delta text, capped so near-zero baselines don't render absurd percentages. */
  get deltaDisplay(): string {
    if (!this.hasDelta) {
      return '';
    }
    const v = this.deltaPercent as number;
    if (Math.abs(v) > this.deltaCap) {
      return (v >= 0 ? '> +' : '< −') + this.deltaCap + '%';
    }
    return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  }

  get deltaPositive(): boolean {
    return (this.deltaPercent ?? 0) >= 0;
  }

  /** Good = green, regardless of arrow direction, honoring higherIsBetter. */
  get deltaIsGood(): boolean {
    return this.higherIsBetter ? this.deltaPositive : !this.deltaPositive;
  }

  get deltaArrowIcon(): string {
    return this.deltaPositive ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
  }

  get sparklinePoints(): string | null {
    const data = this.sparkline;
    if (!data || data.length < 2) {
      return null;
    }
    const w = 100;
    const h = 28;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / (data.length - 1);
    return data
      .map((d, i) => {
        const x = i * step;
        const y = h - ((d - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
}
