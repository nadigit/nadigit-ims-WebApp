import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { TaxRule, TaxRuleDocumentType } from 'src/app/models/tax-rule';
import { TaxRuleService } from 'src/app/services/tax-rule.service';
import { CategoryService } from 'src/app/services/category.service';
import { Category } from 'src/app/models/category';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
  selector: 'app-tax-rules',
  templateUrl: './tax-rules.component.html',
  styleUrls: ['./tax-rules.component.css', '../finance.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class TaxRulesComponent implements OnInit, OnDestroy {
  /** When true, hides page chrome for use inside Settings (tab panel). */
  @Input() embedded = false;

  isLoading = true;
  rules: TaxRule[] = [];
  isAdmin = false;

  dialogVisible = false;
  isEdit = false;
  submitted = false;
  /** Form model bound in dialog */
  form: TaxRule = this.emptyForm();
  /** UI: rate 0–100 for display */
  ratePercent = 0;

  documentTypeOptions: { label: string; value: TaxRuleDocumentType }[] = [];
  categoryOptions: { label: string; value: number | null }[] = [];

  private langSub?: Subscription;

  constructor(
    private taxRuleService: TaxRuleService,
    private categoryService: CategoryService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private keycloak: KeycloakService
  ) {}

  async ngOnInit(): Promise<void> {
    this.translate.use(this.translationService.getPreferredLanguage());
    this.langSub = this.translationService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang);
      this.rebuildDocumentTypeOptions();
    });
    this.rebuildDocumentTypeOptions();
    const roles = await this.keycloak.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    await this.loadCategories();
    await this.refreshList();
    this.isLoading = false;
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  private rebuildDocumentTypeOptions(): void {
    this.documentTypeOptions = [
      { label: this.translate.instant('tax_rule_document_sales'), value: 'SALES' },
      { label: this.translate.instant('tax_rule_document_purchase'), value: 'PURCHASE' },
      { label: this.translate.instant('tax_rule_document_both'), value: 'BOTH' }
    ];
  }

  private emptyForm(): TaxRule {
    return {
      code: '',
      label: '',
      rate: 0,
      documentType: 'BOTH',
      priority: 100,
      active: true,
      productId: null,
      categoryId: null,
      country: null
    };
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categoryService.loadToken();
      const res = await firstValueFrom(this.categoryService.getCategories());
      const list = Array.isArray(res) ? (res as Category[]) : [];
      this.categoryOptions = [
        { label: '—', value: null },
        ...list
          .filter((c) => c.categoryId != null)
          .map((c) => ({ label: c.categoryName || String(c.categoryId), value: c.categoryId! }))
          .sort((a, b) => a.label.localeCompare(b.label))
      ];
    } catch (e) {
      console.error(e);
      this.categoryOptions = [{ label: '—', value: null }];
    }
  }

  async refreshList(): Promise<void> {
    try {
      const obs = await this.taxRuleService.listTaxRules();
      const data = await firstValueFrom(obs);
      this.rules = Array.isArray(data) ? [...data] : [];
      this.rules.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || (a.code || '').localeCompare(b.code || ''));
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('tax_rules_error_load'),
        life: 5000
      });
      this.rules = [];
    }
  }

  openCreate(): void {
    if (!this.isAdmin) return;
    this.isEdit = false;
    this.submitted = false;
    this.form = this.emptyForm();
    this.ratePercent = 0;
    this.dialogVisible = true;
  }

  openEdit(row: TaxRule): void {
    if (!this.isAdmin) return;
    this.isEdit = true;
    this.submitted = false;
    this.form = {
      taxRuleId: row.taxRuleId,
      code: row.code,
      label: row.label,
      rate: row.rate,
      documentType: row.documentType || 'BOTH',
      priority: row.priority ?? 100,
      active: row.active !== false,
      productId: row.productId ?? null,
      categoryId: row.categoryId ?? null,
      country: row.country ?? null
    };
    this.ratePercent = Math.round(((row.rate ?? 0) * 100 + Number.EPSILON) * 100) / 100;
    this.dialogVisible = true;
  }

  hideDialog(): void {
    this.dialogVisible = false;
  }

  rateDisplay(rule: TaxRule): string {
    const r = rule.rate ?? 0;
    return (r * 100).toFixed(2) + ' %';
  }

  confirmDelete(row: TaxRule): void {
    if (!this.isAdmin || row.taxRuleId == null) return;
    this.confirmationService.confirm({
      message: this.translate.instant('tax_rules_delete_confirm', { code: row.code }),
      header: this.translate.instant('confirm_label'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('yes'),
      rejectLabel: this.translate.instant('no'),
      accept: async () => {
        try {
          const obs = await this.taxRuleService.deleteTaxRule(row.taxRuleId!);
          await firstValueFrom(obs);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('tax_rules_deleted'),
            life: 3000
          });
          await this.refreshList();
        } catch (e) {
          console.error(e);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('tax_rules_error_delete'),
            life: 5000
          });
        }
      }
    });
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (!this.form.label?.trim()) return;
    if (!this.isEdit && (!this.form.code || !this.form.code.trim())) return;

    const rate = Math.min(100, Math.max(0, Number(this.ratePercent) || 0)) / 100;
    const payload: TaxRule = {
      code: this.form.code?.trim(),
      label: this.form.label.trim(),
      rate,
      documentType: (this.form.documentType as TaxRuleDocumentType) || 'BOTH',
      priority: this.form.priority != null ? Number(this.form.priority) : 100,
      active: !!this.form.active,
      productId: this.form.productId != null && this.form.productId !== (undefined as any) ? Number(this.form.productId) : null,
      categoryId: this.form.categoryId != null ? Number(this.form.categoryId) : null,
      country: this.form.country?.trim() ? this.form.country.trim() : null
    };

    try {
      if (this.isEdit && this.form.taxRuleId != null) {
        const obs = await this.taxRuleService.updateTaxRule(this.form.taxRuleId, payload);
        await firstValueFrom(obs);
      } else {
        const obs = await this.taxRuleService.createTaxRule(payload);
        await firstValueFrom(obs);
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('tax_rules_saved'),
        life: 3000
      });
      this.hideDialog();
      await this.refreshList();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.error?.message ||
        e?.error?.error ||
        (typeof e?.error === 'string' ? e.error : null) ||
        this.translate.instant('tax_rules_error_save');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: msg,
        life: 6000
      });
    }
  }
}
