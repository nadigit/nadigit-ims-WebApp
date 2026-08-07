import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { EcommerceIntegrationService } from 'src/app/services/ecommerce-integration.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { ShopService } from 'src/app/services/shop.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import {
  EcommerceConnectionTest,
  EcommerceConnectorBundle,
  EcommerceIntegration,
  EcommerceIntegrationHealth,
  EcommercePlatform,
} from 'src/app/models/ecommerce-integration';

/** One table row: the integration plus its merged health and transient per-row UI state. */
interface IntegrationRow extends EcommerceIntegration {
  health?: EcommerceIntegrationHealth;
  testing?: boolean;
  testResult?: EcommerceConnectionTest;
}

@Component({
  selector: 'app-ecommerce-integrations',
  templateUrl: './ecommerce-integrations.component.html',
  styleUrls: ['./ecommerce-integrations.component.css'],
})
export class EcommerceIntegrationsComponent implements OnInit {
  licensed = false;
  isLoading = false;

  rows: IntegrationRow[] = [];

  // Lookups for the form dropdowns
  warehouseOptions: Array<{ label: string; value: number }> = [];
  shopOptions: Array<{ label: string; value: number }> = [];

  platformOptions: Array<{ label: string; value: EcommercePlatform }> = [
    { label: 'Bagisto', value: 'BAGISTO' },
    { label: 'Shopify', value: 'SHOPIFY' },
    { label: 'WooCommerce', value: 'WOOCOMMERCE' },
    { label: 'Custom', value: 'CUSTOM' },
  ];

  // Edit dialog
  dialog = false;
  saving = false;
  submitted = false;
  editing: EcommerceIntegration = this.emptyIntegration();
  /** Bound separately because the DTO never returns the secret; blank = leave unchanged on edit. */
  hmacSecretInput = '';

  // Provision bundle dialog
  bundleDialog = false;
  provisioning = false;
  bundle?: EcommerceConnectorBundle;
  bundleForName = '';

  constructor(
    private service: EcommerceIntegrationService,
    private warehouseService: WarehouseService,
    private shopService: ShopService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.licensed = this.licenseCapabilitiesService.isFeatureEnabled('ECOMMERCE_SYNC');
    if (this.licensed) {
      void this.loadAll();
    }
  }

  goBack(): void {
    this.location.back();
  }

  private emptyIntegration(): EcommerceIntegration {
    return {
      platform: 'BAGISTO',
      name: '',
      storefrontUrl: '',
      warehouseId: null,
      shopId: null,
      webhookPath: '',
      keycloakClientId: '',
      enabled: false,
    };
  }

  async loadAll(): Promise<void> {
    this.isLoading = true;
    try {
      await this.service.loadToken();
      await this.warehouseService.loadToken();
      await this.shopService.loadToken();
      this.loadLookups();
      this.loadIntegrations();
    } catch {
      this.isLoading = false;
    }
  }

  private loadLookups(): void {
    this.warehouseService.getWarehouses().subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data?.content ?? []);
        this.warehouseOptions = list.map((w: any) => ({
          label: w.warehouseName ?? w.name ?? `#${w.warehouseId}`,
          value: w.warehouseId,
        }));
      },
      error: () => (this.warehouseOptions = []),
    });
    this.shopService.getShops().subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data?.content ?? []);
        this.shopOptions = list.map((s: any) => ({
          label: s.shopName ?? s.name ?? `#${s.shopId}`,
          value: s.shopId,
        }));
      },
      error: () => (this.shopOptions = []),
    });
  }

  private loadIntegrations(): void {
    this.isLoading = true;
    this.service.list().subscribe({
      next: (integrations) => {
        this.rows = (integrations || []).map((i) => ({ ...i }));
        this.mergeHealth();
        this.isLoading = false;
      },
      error: () => {
        this.showError('ecommerce_integrations_load_error');
        this.isLoading = false;
      },
    });
  }

  private mergeHealth(): void {
    this.service.health().subscribe({
      next: (healthList) => {
        const byId = new Map<number, EcommerceIntegrationHealth>();
        (healthList || []).forEach((h) => byId.set(h.integrationId, h));
        this.rows = this.rows.map((r) => ({
          ...r,
          health: r.integrationId != null ? byId.get(r.integrationId) : undefined,
        }));
      },
      error: () => {
        /* Health is best-effort; the list still renders without it. */
      },
    });
  }

  // --- CRUD dialog -------------------------------------------------------------------------

  openNew(): void {
    this.editing = this.emptyIntegration();
    this.hmacSecretInput = '';
    this.submitted = false;
    this.dialog = true;
  }

  openEdit(row: IntegrationRow): void {
    this.editing = { ...row };
    this.hmacSecretInput = '';
    this.submitted = false;
    this.dialog = true;
  }

  hideDialog(): void {
    this.dialog = false;
    this.submitted = false;
  }

  save(): void {
    this.submitted = true;
    const name = (this.editing.name || '').trim();
    if (!name || !this.editing.platform) {
      return;
    }
    this.saving = true;
    const secret = this.hmacSecretInput.trim();
    const body = {
      platform: this.editing.platform,
      name,
      storefrontUrl: this.editing.storefrontUrl || null,
      warehouseId: this.editing.warehouseId ?? null,
      shopId: this.editing.shopId ?? null,
      webhookPath: this.editing.webhookPath || null,
      keycloakClientId: this.editing.keycloakClientId || null,
      // Only send the secret when the admin typed one; blank leaves it unchanged (edit) or unset (create).
      hmacSecret: secret ? secret : null,
      enabled: !!this.editing.enabled,
    };

    const done = () => {
      this.saving = false;
      this.dialog = false;
      this.loadIntegrations();
    };
    const fail = (err: any) => {
      this.saving = false;
      this.showBackendError(err, 'ecommerce_integration_save_error');
    };

    if (this.editing.integrationId) {
      this.service.update(this.editing.integrationId, body).subscribe({
        next: () => {
          this.showSuccess('ecommerce_integration_saved');
          done();
        },
        error: fail,
      });
    } else {
      this.service.create(body).subscribe({
        next: () => {
          this.showSuccess('ecommerce_integration_saved');
          done();
        },
        error: fail,
      });
    }
  }

  confirmDelete(row: IntegrationRow): void {
    if (row.integrationId == null) {
      return;
    }
    this.confirmationService.confirm({
      message: this.translate.instant('ecommerce_integration_delete_confirm', { name: row.name }),
      header: this.translate.instant('confirm_label'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.service.delete(row.integrationId!).subscribe({
          next: () => {
            this.showSuccess('ecommerce_integration_deleted');
            this.loadIntegrations();
          },
          error: (err) => this.showBackendError(err, 'ecommerce_integration_delete_error'),
        });
      },
    });
  }

  // --- Provision ---------------------------------------------------------------------------

  provision(row: IntegrationRow): void {
    if (row.integrationId == null) {
      return;
    }
    if (row.warehouseId == null || row.shopId == null) {
      this.showError('error.ecommerce.integration_needs_warehouse_shop');
      return;
    }
    this.provisioning = true;
    this.bundleForName = row.name;
    this.service.provision(row.integrationId).subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        this.bundleDialog = true;
        this.provisioning = false;
        this.loadIntegrations();
      },
      error: (err) => {
        this.provisioning = false;
        this.showBackendError(err, 'ecommerce_integration_provision_error');
      },
    });
  }

  async copy(value: string | undefined): Promise<void> {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      this.showSuccess('copied_to_clipboard');
    } catch {
      this.messageService.add({ severity: 'warn', summary: this.t('warning'), detail: value, life: 6000 });
    }
  }

  copyBundleJson(): void {
    if (!this.bundle) {
      return;
    }
    void this.copy(JSON.stringify(this.bundle, null, 2));
  }

  // --- Test connection ---------------------------------------------------------------------

  testConnection(row: IntegrationRow): void {
    if (row.integrationId == null) {
      return;
    }
    row.testing = true;
    row.testResult = undefined;
    this.service.testConnection(row.integrationId).subscribe({
      next: (result) => {
        row.testResult = result;
        row.testing = false;
        this.messageService.add({
          severity: result.reachable ? 'success' : 'error',
          summary: this.t(result.reachable ? 'ecommerce_connection_reachable' : 'ecommerce_connection_unreachable'),
          detail: `${result.detail ?? ''} (${result.durationMs} ms)`.trim(),
          life: 5000,
        });
      },
      error: (err) => {
        row.testing = false;
        this.showBackendError(err, 'ecommerce_connection_unreachable');
      },
    });
  }

  // --- View helpers ------------------------------------------------------------------------

  platformLabel(p: EcommercePlatform | undefined): string {
    return this.platformOptions.find((o) => o.value === p)?.label ?? String(p ?? '');
  }

  warehouseLabel(id: number | null | undefined): string {
    if (id == null) {
      return '—';
    }
    return this.warehouseOptions.find((o) => o.value === id)?.label ?? `#${id}`;
  }

  shopLabel(id: number | null | undefined): string {
    if (id == null) {
      return '—';
    }
    return this.shopOptions.find((o) => o.value === id)?.label ?? `#${id}`;
  }

  statusSeverity(status: string | undefined): 'success' | 'warning' | 'danger' | 'info' {
    switch (status) {
      case 'SUCCESS':
        return 'success';
      case 'WARNING':
        return 'warning';
      case 'FAILED':
      case 'CONFLICT':
        return 'danger';
      default:
        return 'info';
    }
  }

  /** A row is ready to provision once it has a warehouse and shop bound. */
  canProvision(row: IntegrationRow): boolean {
    return row.warehouseId != null && row.shopId != null;
  }

  // --- Toast helpers -----------------------------------------------------------------------

  private t(key: string): string {
    return this.translate.instant(key);
  }

  private showSuccess(key: string): void {
    this.messageService.add({ severity: 'success', summary: this.t('success'), detail: this.t(key), life: 3000 });
  }

  private showError(key: string): void {
    this.messageService.add({ severity: 'error', summary: this.t('error'), detail: this.t(key), life: 4000 });
  }

  /** Prefer the backend's localized message when present, else a generic fallback key. */
  private showBackendError(err: any, fallbackKey: string): void {
    const backend = err?.error;
    const detail =
      (typeof backend === 'string' && backend) ||
      backend?.message ||
      backend?.error ||
      this.t(fallbackKey);
    this.messageService.add({ severity: 'error', summary: this.t('error'), detail, life: 6000 });
  }
}
