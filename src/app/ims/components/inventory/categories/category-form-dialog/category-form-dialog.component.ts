import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';

// Models and Services
import { Category } from 'src/app/models/category';
import { TranslateService } from '@ngx-translate/core';

export interface CategoryFormDialogData {
  category: Category;
}

export interface CategoryFormDialogConfig {
  visible: boolean;
  mode: 'create' | 'edit';
  category: Category;
  isLoading: boolean;
}

@Component({
  selector: 'app-category-form-dialog',
  templateUrl: './category-form-dialog.component.html',
  styleUrl: './category-form-dialog.component.scss'
})
export class CategoryFormDialogComponent implements OnInit, OnChanges {

  @Input() config!: CategoryFormDialogConfig;
  @Input() submitted: boolean = false;

  @Output() configChange = new EventEmitter<CategoryFormDialogConfig>();
  @Output() save = new EventEmitter<CategoryFormDialogData>();
  @Output() cancel = new EventEmitter<void>();

  costingMethods: any[] = [];

  constructor(
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.initializeCostingMethods();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Handle config changes if needed
  }

  private initializeCostingMethods(): void {
    this.costingMethods = [
      { label: this.translate.instant('costing_method_fifo'), value: 'FIFO' },
      { label: this.translate.instant('costing_method_lifo'), value: 'LIFO' },
      { label: this.translate.instant('costing_method_weighted_average'), value: 'WEIGHTED_AVERAGE' },
      { label: this.translate.instant('costing_method_standard_cost'), value: 'STANDARD_COST' },
      { label: this.translate.instant('costing_method_none'), value: 'NONE' }
    ];
  }

  onSave() {
    const dialogData: CategoryFormDialogData = {
      category: this.config.category
    };

    this.save.emit(dialogData);
  }

  onCancel() {
    this.cancel.emit();
  }

  hideDialog() {
    const updatedConfig = { ...this.config, visible: false };
    this.configChange.emit(updatedConfig);
  }
}