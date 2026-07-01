import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { CategoryDeleteImpact } from 'src/app/models/category';
import { CategoryService } from 'src/app/services/category.service';

@Component({
  selector: 'app-category-delete-dialog',
  templateUrl: './category-delete-dialog.component.html',
  styleUrls: ['../../products/product-action-dialog.shared.scss'],
})
export class CategoryDeleteDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() categoryId: number | null | undefined = null;
  /** When true, administrators get a force-delete button even if the category is referenced. */
  @Input() canForceDelete = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<number>();
  /** Emitted when an administrator confirms deletion despite blocking references. */
  @Output() forceConfirmed = new EventEmitter<number>();

  loading = false;
  impact: CategoryDeleteImpact | null = null;

  constructor(
    private categoryService: CategoryService,
    private translate: TranslateService,
    private messageService: MessageService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['categoryId']) && this.visible && this.categoryId) {
      void this.loadImpact();
    }
    if (changes['visible'] && !this.visible) {
      this.impact = null;
      this.loading = false;
    }
  }

  async loadImpact(): Promise<void> {
    if (!this.categoryId) {
      return;
    }

    this.loading = true;
    this.impact = null;

    try {
      this.impact = await firstValueFrom(
        this.categoryService.getCategoryDeleteImpact(this.categoryId)
      ) as CategoryDeleteImpact;
    } catch {
      this.onVisibleChange(false);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_delete_impact'),
        life: 3000,
      });
    } finally {
      this.loading = false;
    }
  }

  getDeleteImpactLabel(type: string): string {
    return this.translate.instant('category_delete_impact_' + type.toLowerCase());
  }

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  onCancel(): void {
    this.onVisibleChange(false);
  }

  onConfirm(): void {
    if (this.loading || !this.impact?.canDelete || !this.categoryId) {
      return;
    }

    const id = this.categoryId;
    this.onVisibleChange(false);
    this.confirmed.emit(id);
  }

  /** Whether the force-delete action should be offered (admin + blocked category). */
  get showForceDelete(): boolean {
    return this.canForceDelete && !!this.impact && !this.impact.canDelete;
  }

  onForceConfirm(): void {
    if (this.loading || !this.showForceDelete || !this.categoryId) {
      return;
    }

    const id = this.categoryId;
    this.onVisibleChange(false);
    this.forceConfirmed.emit(id);
  }
}
