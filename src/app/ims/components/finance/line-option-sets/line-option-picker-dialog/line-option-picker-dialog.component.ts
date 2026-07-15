import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LineOptionSet } from 'src/app/models/line-option-set';
import {
  activeLineOptions,
  LineOptionConstraintViolation,
  validateLineOptionSelection
} from 'src/app/utils/line-option-selection.util';

/**
 * Sale-time picker for line options (order/POS line UX of Capability A). Shows the option
 * sets applicable to a line, enforces SINGLE / min / max constraints, and emits the chosen
 * option ids on apply. Pure UI — the caller loads the sets and persists the selection.
 */
@Component({
  selector: 'app-line-option-picker-dialog',
  templateUrl: './line-option-picker-dialog.component.html',
  styleUrls: ['./line-option-picker-dialog.component.css']
})
export class LineOptionPickerDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() sets: LineOptionSet[] = [];
  @Input() selectedIds: number[] = [];
  /** Line context shown in the header (product name). */
  @Input() productName: string | null = null;
  @Output() apply = new EventEmitter<number[]>();

  /** Working copy so cancel leaves the caller's selection untouched. */
  workingIds = new Set<number>();
  violation: LineOptionConstraintViolation | null = null;

  activeLineOptions = activeLineOptions;

  constructor(private translate: TranslateService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.workingIds = new Set(this.selectedIds || []);
      this.violation = null;
    }
  }

  isSelected(optionId: number | undefined): boolean {
    return optionId != null && this.workingIds.has(optionId);
  }

  toggle(set: LineOptionSet, optionId: number | undefined): void {
    if (optionId == null) return;
    if (this.workingIds.has(optionId)) {
      this.workingIds.delete(optionId);
    } else {
      if (set.selectionMode === 'SINGLE') {
        // Single choice: picking an option replaces the set's previous selection.
        for (const option of activeLineOptions(set)) {
          if (option.lineOptionId != null) {
            this.workingIds.delete(option.lineOptionId);
          }
        }
      }
      this.workingIds.add(optionId);
    }
    this.violation = null;
  }

  constraintHint(set: LineOptionSet): string {
    const parts: string[] = [];
    parts.push(this.translate.instant(
      set.selectionMode === 'MULTI' ? 'line_option_set_mode_multi' : 'line_option_set_mode_single'
    ));
    const min = set.minSelect ?? 0;
    if (min > 0) {
      parts.push(this.translate.instant('line_option_picker_min_hint', { count: min }));
    }
    if (set.maxSelect != null) {
      parts.push(this.translate.instant('line_option_picker_max_hint', { count: set.maxSelect }));
    }
    return parts.join(' · ');
  }

  violationMessage(): string {
    if (!this.violation) return '';
    const label = this.violation.set.label || this.violation.set.code || '';
    switch (this.violation.kind) {
      case 'single':
        return this.translate.instant('line_option_picker_error_single', { set: label });
      case 'max':
        return this.translate.instant('line_option_picker_error_max', { set: label, count: this.violation.limit });
      default:
        return this.translate.instant('line_option_picker_error_min', { set: label, count: this.violation.limit });
    }
  }

  hideDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onApply(): void {
    const ids = Array.from(this.workingIds);
    this.violation = validateLineOptionSelection(this.sets, ids);
    if (this.violation) {
      return;
    }
    this.apply.emit(ids);
    this.hideDialog();
  }
}
