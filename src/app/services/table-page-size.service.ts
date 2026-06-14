import { Injectable } from '@angular/core';
import {
  getStoredTablePageSize,
  initTablePageSizeState,
  persistTablePageSizeFromPageEvent,
  storeTablePageSize,
} from '../utils/table-page-size.storage';

/**
 * Cached accessor for table page sizes — use in templates for client-side / detail tables:
 * `[rows]="pageSizeService.get(key, options)" (onPage)="pageSizeService.onPage(key, options, $event)"`
 */
@Injectable({ providedIn: 'root' })
export class TablePageSizeService {
  private readonly cache = new Map<string, number>();

  get(storageKey: string, allowedOptions: readonly number[], fallback?: number): number {
    const cacheKey = this.toCacheKey(storageKey, allowedOptions);
    if (!this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, getStoredTablePageSize(storageKey, allowedOptions, fallback));
    }
    return this.cache.get(cacheKey)!;
  }

  onPage(storageKey: string, allowedOptions: readonly number[], event: { rows?: number | null }): void {
    if (event.rows == null || !allowedOptions.includes(event.rows)) {
      return;
    }
    const cacheKey = this.toCacheKey(storageKey, allowedOptions);
    this.cache.set(cacheKey, event.rows);
    storeTablePageSize(storageKey, allowedOptions, event.rows);
  }

  initState(
    storageKey: string,
    allowedOptions: readonly number[],
    state: {
      pageSize?: number;
      rows?: number;
      lastLazyLoadEvent?: { rows?: number };
    },
    fallback?: number
  ): number {
    const size = initTablePageSizeState(storageKey, allowedOptions, state, fallback);
    this.cache.set(this.toCacheKey(storageKey, allowedOptions), size);
    return size;
  }

  applyPageEvent(
    storageKey: string,
    allowedOptions: readonly number[],
    event: { rows?: number | null },
    state: { pageSize: number }
  ): void {
    persistTablePageSizeFromPageEvent(storageKey, allowedOptions, event, state);
    if (event.rows != null && allowedOptions.includes(event.rows)) {
      this.cache.set(this.toCacheKey(storageKey, allowedOptions), event.rows);
    }
  }

  private toCacheKey(storageKey: string, allowedOptions: readonly number[]): string {
    return `${storageKey}:${allowedOptions.join(',')}`;
  }
}
