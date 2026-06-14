import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ProductArchiveDialogMode = 'archive' | 'unarchive';

@Component({
  selector: 'app-product-archive-dialog',
  templateUrl: './product-archive-dialog.component.html',
  styleUrls: ['../product-action-dialog.shared.scss'],
})
export class ProductArchiveDialogComponent {
  @Input() visible = false;
  @Input() productName = '';
  @Input() mode: ProductArchiveDialogMode = 'archive';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<void>();

  get titleKey(): string {
    return this.mode === 'unarchive'
      ? 'unarchive_product_confirmation'
      : 'archive_product_confirmation';
  }

  get confirmIcon(): string {
    return this.mode === 'unarchive' ? 'pi pi-refresh' : 'pi pi-folder';
  }

  get confirmSeverityClass(): string {
    return this.mode === 'unarchive' ? 'p-button-primary' : 'p-button-warning';
  }

  get heroIconClass(): string {
    return this.mode === 'unarchive' ? 'pi pi-refresh' : 'pi pi-folder';
  }

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  onCancel(): void {
    this.onVisibleChange(false);
  }

  onConfirm(): void {
    this.onVisibleChange(false);
    this.confirmed.emit();
  }
}
