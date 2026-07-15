import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom } from 'rxjs';
import { LineOptionSet } from 'src/app/models/line-option-set';
import { LineOptionSetService } from 'src/app/services/line-option-set.service';

/**
 * Compact "attach option sets" control embedded in the product and category
 * edit forms. Lists the active option sets scoped to the entity, lets an admin
 * create a new set pre-scoped to it, edit one, or detach one (the set is kept
 * but loses its scope). Exactly one of `productId` / `categoryId` must be set.
 */
@Component({
  selector: 'app-line-option-set-attach',
  templateUrl: './line-option-set-attach.component.html',
  styleUrls: ['./line-option-set-attach.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class LineOptionSetAttachComponent implements OnChanges {
  @Input() productId: number | null = null;
  @Input() categoryId: number | null = null;

  isAdmin = false;
  loading = false;
  sets: LineOptionSet[] = [];

  dialogVisible = false;
  editingSet: LineOptionSet | null = null;

  private rolesLoaded = false;

  constructor(
    private lineOptionSetService: LineOptionSetService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private keycloak: KeycloakService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] || changes['categoryId']) {
      void this.init();
    }
  }

  private async init(): Promise<void> {
    if (!this.rolesLoaded) {
      const roles = await this.keycloak.getUserRoles();
      this.isAdmin = roles.includes('ADMIN');
      this.rolesLoaded = true;
    }
    await this.reload();
  }

  async reload(): Promise<void> {
    if (this.productId == null && this.categoryId == null) {
      this.sets = [];
      return;
    }
    this.loading = true;
    try {
      const obs = this.productId != null
        ? await this.lineOptionSetService.forProduct(this.productId)
        : await this.lineOptionSetService.forCategory(this.categoryId!);
      const data = await firstValueFrom(obs);
      this.sets = Array.isArray(data) ? [...data] : [];
      this.sets.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    } catch (e) {
      console.error(e);
      this.sets = [];
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('line_option_sets_error_load'),
        life: 5000
      });
    } finally {
      this.loading = false;
    }
  }

  modeDisplay(set: LineOptionSet): string {
    return this.translate.instant(
      set.selectionMode === 'MULTI' ? 'line_option_set_mode_multi' : 'line_option_set_mode_single'
    );
  }

  openCreate(): void {
    if (!this.isAdmin) return;
    this.editingSet = null;
    this.dialogVisible = true;
  }

  openEdit(set: LineOptionSet): void {
    if (!this.isAdmin) return;
    this.editingSet = set;
    this.dialogVisible = true;
  }

  /** Detach keeps the set but clears its product/category scope. */
  confirmDetach(set: LineOptionSet): void {
    if (!this.isAdmin || set.lineOptionSetId == null) return;
    this.confirmationService.confirm({
      message: this.translate.instant('line_option_sets_detach_confirm', { code: set.code }),
      header: this.translate.instant('confirm_label'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('yes'),
      rejectLabel: this.translate.instant('no'),
      accept: async () => {
        try {
          const payload: LineOptionSet = {
            code: set.code,
            label: set.label,
            selectionMode: set.selectionMode,
            minSelect: set.minSelect ?? 0,
            maxSelect: set.maxSelect ?? null,
            active: set.active !== false,
            productId: null,
            categoryId: null,
            options: set.options || []
          };
          const obs = await this.lineOptionSetService.update(set.lineOptionSetId!, payload);
          await firstValueFrom(obs);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('line_option_sets_detached'),
            life: 3000
          });
          await this.reload();
        } catch (e: any) {
          console.error(e);
          const msg =
            e?.error?.message ||
            e?.error?.error ||
            (typeof e?.error === 'string' ? e.error : null) ||
            this.translate.instant('line_option_sets_error_detach');
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: msg,
            life: 6000
          });
        }
      }
    });
  }

  async onSaved(): Promise<void> {
    await this.reload();
  }
}
