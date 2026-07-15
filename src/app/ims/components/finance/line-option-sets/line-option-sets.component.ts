import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { LineOptionSet } from 'src/app/models/line-option-set';
import { LineOptionSetService } from 'src/app/services/line-option-set.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

@Component({
  selector: 'app-line-option-sets',
  templateUrl: './line-option-sets.component.html',
  styleUrls: ['./line-option-sets.component.css', '../finance.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class LineOptionSetsComponent implements OnInit, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;
  /** When true, hides page chrome for embedding (e.g. in Settings). */
  @Input() embedded = false;

  isLoading = true;
  sets: LineOptionSet[] = [];
  isAdmin = false;

  dialogVisible = false;
  /** Set being edited in the dialog; null = create. */
  editingSet: LineOptionSet | null = null;

  private langSub?: Subscription;

  constructor(
    private lineOptionSetService: LineOptionSetService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private keycloak: KeycloakService,
    public pageSizeService: TablePageSizeService
  ) {}

  async ngOnInit(): Promise<void> {
    this.translate.use(this.translationService.getPreferredLanguage());
    this.langSub = this.translationService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang);
    });
    const roles = await this.keycloak.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    await this.refreshList();
    this.isLoading = false;
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  async refreshList(): Promise<void> {
    try {
      const obs = await this.lineOptionSetService.list();
      const data = await firstValueFrom(obs);
      this.sets = Array.isArray(data) ? [...data] : [];
      this.sets.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('line_option_sets_error_load'),
        life: 5000
      });
      this.sets = [];
    }
  }

  /** Table display: product / category the set is attached to, or "Global". */
  scopeDisplay(set: LineOptionSet): string {
    if (set.productId) {
      const name = set.productName || `#${set.productId}`;
      return set.productReference ? `${name} (${set.productReference})` : name;
    }
    if (set.categoryId) {
      return set.categoryName || `#${set.categoryId}`;
    }
    return this.translate.instant('line_option_set_scope_global');
  }

  modeDisplay(set: LineOptionSet): string {
    return this.translate.instant(
      set.selectionMode === 'MULTI' ? 'line_option_set_mode_multi' : 'line_option_set_mode_single'
    );
  }

  optionCount(set: LineOptionSet): number {
    return set.options?.length || 0;
  }

  openCreate(): void {
    if (!this.isAdmin) return;
    this.editingSet = null;
    this.dialogVisible = true;
  }

  openEdit(row: LineOptionSet): void {
    if (!this.isAdmin) return;
    this.editingSet = row;
    this.dialogVisible = true;
  }

  confirmDelete(row: LineOptionSet): void {
    if (!this.isAdmin || row.lineOptionSetId == null) return;
    this.confirmationService.confirm({
      message: this.translate.instant('line_option_sets_delete_confirm', { code: row.code }),
      header: this.translate.instant('confirm_label'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('yes'),
      rejectLabel: this.translate.instant('no'),
      accept: async () => {
        try {
          const obs = await this.lineOptionSetService.remove(row.lineOptionSetId!);
          await firstValueFrom(obs);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('line_option_sets_deleted'),
            life: 3000
          });
          await this.refreshList();
        } catch (e) {
          console.error(e);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('line_option_sets_error_delete'),
            life: 5000
          });
        }
      }
    });
  }

  async onSaved(): Promise<void> {
    await this.refreshList();
  }
}
