import { LineOption, LineOptionSet } from '../models/line-option-set';

/**
 * Client-side helpers for sale-line option selection (Capability A of configurable sale
 * pricing). Mirrors the backend `LineOptionSelectionService` rules: defaults are auto-selected
 * per set, then SINGLE / minSelect / maxSelect constraints apply.
 */

export function activeLineOptions(set: LineOptionSet): LineOption[] {
  return (set.options || []).filter(o => o.active !== false);
}

/** Option ids auto-selected when the user made no choice yet (the sets' defaults). */
export function defaultLineOptionIds(sets: LineOptionSet[]): number[] {
  const ids: number[] = [];
  for (const set of sets) {
    for (const option of activeLineOptions(set)) {
      if (option.defaultSelected && option.lineOptionId != null) {
        ids.push(option.lineOptionId);
      }
    }
  }
  return ids;
}

export interface LineOptionConstraintViolation {
  set: LineOptionSet;
  kind: 'single' | 'min' | 'max';
  limit: number;
}

/** First violated constraint across the sets, or null when the selection is valid. */
export function validateLineOptionSelection(
  sets: LineOptionSet[],
  selectedIds: number[]
): LineOptionConstraintViolation | null {
  const selected = new Set(selectedIds);
  for (const set of sets) {
    const count = activeLineOptions(set).filter(
      o => o.lineOptionId != null && selected.has(o.lineOptionId)
    ).length;
    if (set.selectionMode === 'SINGLE' && count > 1) {
      return { set, kind: 'single', limit: 1 };
    }
    if (set.maxSelect != null && count > set.maxSelect) {
      return { set, kind: 'max', limit: set.maxSelect };
    }
    const min = set.minSelect ?? 0;
    if (count < min) {
      return { set, kind: 'min', limit: min };
    }
  }
  return null;
}

/** Labels of the selected options, in set/sort order (line chips display). */
export function selectedLineOptionLabels(sets: LineOptionSet[], selectedIds: number[]): string[] {
  const selected = new Set(selectedIds);
  const labels: string[] = [];
  for (const set of sets) {
    for (const option of activeLineOptions(set)) {
      if (option.lineOptionId != null && selected.has(option.lineOptionId)) {
        labels.push(option.label || option.code || String(option.lineOptionId));
      }
    }
  }
  return labels;
}
