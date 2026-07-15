import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { KeycloakService } from 'keycloak-angular';

// Models and Services
import { Category } from 'src/app/models/category';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { CategoryService } from 'src/app/services/category.service';
import { TaxRuleService } from 'src/app/services/tax-rule.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';

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
  imageUploading = false;

  /** Enterprise VAT assignment (edit mode only: the category id must exist). */
  vatFeatureReady = false;
  vatOptions: { label: string; value: number | null }[] = [];
  selectedVatRate: number | null = null;
  private initialVatRate: number | null = null;
  private isAdmin = false;

  constructor(
    private translate: TranslateService,
    private categoryService: CategoryService,
    private messageService: MessageService,
    private taxRuleService: TaxRuleService,
    private configService: AppConfigurationService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    private keycloak: KeycloakService
  ) {}

  get showVatField(): boolean {
    return this.vatFeatureReady && this.isAdmin && this.config?.mode === 'edit' && !!this.config?.category?.categoryId;
  }

  /** Sale line option sets can only be attached once the category exists (edit mode, admin). */
  get showLineOptionSets(): boolean {
    return this.isAdmin && this.config?.mode === 'edit' && !!this.config?.category?.categoryId;
  }

  private async initVatFeature(): Promise<void> {
    try {
      const roles = await this.keycloak.getUserRoles();
      this.isAdmin = roles.includes('ADMIN');
      if (!this.isAdmin || !this.licenseCapabilitiesService.isFeatureEnabled('TAX_RULE_ENGINE')) {
        this.vatFeatureReady = false;
        return;
      }
      const modeCfg: any = await firstValueFrom(await this.configService.getConfiguration('tax.calculation.mode')).catch(() => null);
      if (String(modeCfg?.value || 'GLOBAL').toUpperCase() !== 'RULES') {
        this.vatFeatureReady = false;
        return;
      }
      const rules: any[] = await firstValueFrom(await this.taxRuleService.listTaxRules()).catch(() => []);
      const seen = new Set<number>();
      const options: { label: string; value: number | null }[] = [
        { label: this.translate.instant('category_vat_inherited'), value: null }
      ];
      for (const rule of (rules || []).filter(r => r.active !== false)) {
        const rate = Number(rule.rate ?? 0);
        const key = Math.round(rate * 10000);
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ label: `${(rate * 100).toFixed(2)} %`, value: rate });
      }
      options.sort((a, b) => (a.value ?? -1) - (b.value ?? -1));
      this.vatOptions = options;
      this.vatFeatureReady = true;
    } catch {
      this.vatFeatureReady = false;
    }
  }

  private async loadVatStateForCategory(): Promise<void> {
    this.selectedVatRate = null;
    this.initialVatRate = null;
    const id = this.config?.category?.categoryId;
    if (!this.vatFeatureReady || !id) return;
    try {
      const rule: any = await firstValueFrom(await this.taxRuleService.getCategoryVatRule(id)).catch(() => null);
      if (rule && rule.rate != null) {
        const rate = Number(rule.rate);
        this.selectedVatRate = rate;
        this.initialVatRate = rate;
        if (!this.vatOptions.some(o => o.value != null && Math.round(o.value * 10000) === Math.round(rate * 10000))) {
          this.vatOptions = [...this.vatOptions, { label: `${(rate * 100).toFixed(2)} %`, value: rate }];
        }
      }
    } catch {
      /* non-blocking */
    }
  }

  private async applyVatSelection(): Promise<void> {
    const id = this.config?.category?.categoryId;
    if (!this.showVatField || !id) return;
    const changed = (this.selectedVatRate ?? null) !== (this.initialVatRate ?? null);
    if (!changed) return;
    try {
      if (this.selectedVatRate == null) {
        await firstValueFrom(await this.taxRuleService.clearCategoryVatRule(id));
      } else {
        await firstValueFrom(await this.taxRuleService.setCategoryVatRule(id, this.selectedVatRate));
      }
      this.initialVatRate = this.selectedVatRate;
    } catch (e) {
      console.error('Failed to apply category VAT assignment:', e);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('category_vat_assign_failed'),
        life: 5000
      });
    }
  }

  /** Uploads the file chosen in the shared image-upload control and stores its URL. */
  onImageFile(file: File): void {
    this.imageUploading = true;
    this.categoryService.loadToken();
    this.categoryService.uploadCategoryImage(file).subscribe({
      next: (res) => {
        this.config.category.categoryImage = res?.url;
        this.imageUploading = false;
      },
      error: () => {
        this.imageUploading = false;
        this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('image_upload_failed'), life: 3000 });
      }
    });
  }

  /** Surfaces a rejected-file reason (translation key) from the image-upload control. */
  onImageValidationError(messageKey: string): void {
    this.messageService.add({ severity: 'warn', summary: this.translate.instant('warning'), detail: this.translate.instant(messageKey), life: 3000 });
  }

  removeImage(): void {
    this.config.category.categoryImage = undefined;
  }

  ngOnInit() {
    this.initializeCostingMethods();
    void this.initVatFeature().then(() => this.loadVatStateForCategory());
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reload the VAT assignment whenever the dialog opens on a (different) category.
    if (changes['config'] && this.config?.visible) {
      void this.loadVatStateForCategory();
    }
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

  async onSave() {
    // Persist the enterprise VAT assignment first (no-op when unchanged/unavailable);
    // the parent then saves the category fields themselves.
    await this.applyVatSelection();

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