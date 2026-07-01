import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { WarehouseTransfer, TransferItem, BatchMetadata } from 'src/app/models/warehouseTransfer';
import { WarehouseTransferService } from 'src/app/services/warehouse-transfer.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { TranslationService } from 'src/app/services/translation.service';
import { BatchMetadataUtil } from 'src/app/utils/batch-metadata.util';
import { firstValueFrom } from 'rxjs';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';
import {
  displayWarehouseStockQuantity,
  formatLineQuantity,
  getLineMeasureUnit,
} from 'src/app/shared/product-utils';
import { Product } from 'src/app/models/product';

@Component({
  selector: 'app-transfer-details-page',
  templateUrl: './transfer-details-page.component.html',
  styleUrls: ['./transfer-details-page.component.css', '../warehouse-transfers.component.css']
})
export class TransferDetailsPageComponent implements OnInit {
  TablePageSizeKeys = TablePageSizeKeys;
  transferId!: number;
  transfer: WarehouseTransfer | null = null;
  isLoading: boolean = true;
  
  canEdit: boolean = false;
  canRead: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  resource: string = 'WAREHOUSE_TRANSFERS';

  transferEvents: any[] = [];

  // Confirmation dialogs
  initiateConfirmDialog: boolean = false;
  completeConfirmDialog: boolean = false;
  cancelConfirmDialog: boolean = false;

  currency: any;

  transferAutoApply: boolean = false;
  transferWorkflowConfigLoaded: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private transferService: WarehouseTransferService,
    private messageService: MessageService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    public activityProfileService: ActivityProfileService,
    public pageSizeService: TablePageSizeService,
  ) {}

  async ngOnInit() {
    this.isLoading = true;

    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      await this.activityProfileService.ensureLoaded();
      this.transferId = +params['id'];
      if (!this.transferId || isNaN(this.transferId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_transfer_id'),
          life: 3000
        });
        this.router.navigate(['/inventory/warehouse-transfers']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadTransferWorkflowConfig();
      await this.loadTransfer();
    });
  }

  private async loadTransferWorkflowConfig(): Promise<void> {
    try {
      const cfg = await firstValueFrom(await this.transferService.getTransferConfig());
      this.transferAutoApply = !!cfg?.autoApply;
    } catch (e) {
      console.warn('Could not load warehouse transfer config', e);
      this.transferAutoApply = false;
    } finally {
      this.transferWorkflowConfigLoaded = true;
    }
  }

  async loadTransfer(): Promise<void> {
    try {
      const response = await firstValueFrom(await this.transferService.getTransfer(this.transferId));
      console.log('Transfer API response:', response);
      
      // Handle different response formats
      if (Array.isArray(response)) {
        this.transfer = response[0] as WarehouseTransfer;
      } else if (response && typeof response === 'object') {
        this.transfer = response as WarehouseTransfer;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.transfer || !this.transfer.transferId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('transfer_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/warehouse-transfers']);
        return;
      }

      this.buildTransferTimeline(this.transfer);
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading transfer:', error);
      this.isLoading = false;
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_loading_transfer');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 3000
      });
      setTimeout(() => {
        this.router.navigate(['/inventory/warehouse-transfers']);
      }, 2000);
    }
  }

  buildTransferTimeline(transfer: WarehouseTransfer) {
    this.transferEvents = [];
    
    if (transfer.creationDate) {
      this.transferEvents.push({
        status: 'CREATED',
        date: transfer.creationDate,
        user: transfer.createdBy || 'System',
        icon: 'pi pi-plus-circle',
        color: 'primary'
      });
    }

    if (transfer.initiatedDate) {
      this.transferEvents.push({
        status: 'IN_TRANSIT',
        date: transfer.initiatedDate,
        user: transfer.initiatedBy || 'System',
        icon: 'pi pi-truck',
        color: 'info'
      });
    }

    if (transfer.completedDate) {
      this.transferEvents.push({
        status: 'COMPLETED',
        date: transfer.completedDate,
        user: transfer.completedBy || 'System',
        icon: 'pi pi-check-circle',
        color: 'success'
      });
    }

    if (transfer.cancelledDate) {
      this.transferEvents.push({
        status: 'CANCELLED',
        date: transfer.cancelledDate,
        user: transfer.cancelledBy || 'System',
        icon: 'pi pi-times-circle',
        color: 'danger'
      });
    }
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canEdit = this.permissionService.canUpdate(this.resource);
    this.canRead = this.permissionService.canRead(this.resource);
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  // Status helpers
  getStatusSeverity(status: string | undefined): string {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'PENDING') return 'warning';
    if (s === 'IN_TRANSIT') return 'info';
    if (s === 'COMPLETED') return 'success';
    if (s === 'CANCELLED') return 'danger';
    return '';
  }

  getStatusIcon(status: string | undefined): string {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'PENDING') return 'pi pi-clock';
    if (s === 'IN_TRANSIT') return 'pi pi-truck';
    if (s === 'COMPLETED') return 'pi pi-check-circle';
    if (s === 'CANCELLED') return 'pi pi-times-circle';
    return '';
  }

  canInitiate(transfer: WarehouseTransfer): boolean {
    return transfer.status === 'PENDING' && this.canEdit;
  }

  canComplete(transfer: WarehouseTransfer): boolean {
    return transfer.status === 'IN_TRANSIT' && this.canEdit;
  }

  canCancel(transfer: WarehouseTransfer): boolean {
    return (transfer.status === 'PENDING' || transfer.status === 'IN_TRANSIT') && this.canEdit;
  }

  /** Total in display units (informational; transfers may mix products/units). */
  getTotalQuantity(transfer: WarehouseTransfer): number {
    return transfer.transferItems?.reduce(
      (sum, item) => sum + displayWarehouseStockQuantity(item.product as Product, item.quantity ?? 0), 0) || 0;
  }

  /** A line's quantity in display units (e.g. 0.5 kg) using its own product's tracking mode. */
  getItemDisplayQuantity(item: TransferItem): number {
    return displayWarehouseStockQuantity(item?.product as Product, item?.quantity ?? 0);
  }

  formatItemQuantity(item: TransferItem): string {
    return formatLineQuantity(item?.product as Product, this.getItemDisplayQuantity(item));
  }

  getItemQuantityUnit(item: TransferItem): string {
    return getLineMeasureUnit(item?.product as Product, this.getItemDisplayQuantity(item));
  }

  /** A batch-metadata quantity (storage) converted to the line product's display units. */
  formatBatchQuantity(item: TransferItem, storageQuantity: number | null | undefined): string {
    const displayQty = displayWarehouseStockQuantity(item?.product as Product, storageQuantity ?? 0);
    const formatted = formatLineQuantity(item?.product as Product, displayQty);
    const unit = getLineMeasureUnit(item?.product as Product, displayQty);
    return unit ? `${formatted} ${this.translate.instant(unit)}` : formatted;
  }

  // Batch Metadata Methods
  getBatchMetadata(item: TransferItem): BatchMetadata[] {
    return BatchMetadataUtil.parseBatchMetadata(item.batchMetadata);
  }

  hasBatchInfo(item: TransferItem): boolean {
    return BatchMetadataUtil.hasBatchMetadata(item.batchMetadata);
  }

  formatBatchDate(date: string | null | undefined): string {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  }

  formatCurrency(amount: number | null | undefined): string {
    if (amount == null || amount === undefined || isNaN(amount)) return '-';
    const currencyCode = this.currency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Action Methods
  openInitiateConfirm() {
    if (!this.transfer) return;
    this.initiateConfirmDialog = true;
  }

  async confirmInitiate() {
    if (!this.transfer?.transferId) return;

    this.isLoading = true;
    try {
      const response = await firstValueFrom(await this.transferService.initiateTransfer(this.transfer.transferId));
      this.isLoading = false;
      this.initiateConfirmDialog = false;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('transfer_initiated_successfully'),
        life: 3000
      });
      await this.loadTransfer();
    } catch (err: any) {
      this.isLoading = false;
      console.error('Error initiating transfer:', err);
      let errorMessage = this.translate.instant('error_initiating_transfer');
      
      if (err.error?.message) {
        errorMessage = err.error.message;
      } else if (err.status === 400) {
        errorMessage = this.translate.instant('cannot_initiate_transfer') + ': ' + (this.transfer?.status || 'Unknown status');
      }

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 5000
      });
    }
  }

  openCompleteConfirm() {
    if (!this.transfer) return;
    this.completeConfirmDialog = true;
  }

  async confirmComplete() {
    if (!this.transfer?.transferId) return;

    this.isLoading = true;
    try {
      const response = await firstValueFrom(await this.transferService.completeTransfer(this.transfer.transferId));
      this.isLoading = false;
      this.completeConfirmDialog = false;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('transfer_completed_successfully'),
        life: 3000
      });
      await this.loadTransfer();
    } catch (err: any) {
      this.isLoading = false;
      console.error('Error completing transfer:', err);
      let errorMessage = this.translate.instant('error_completing_transfer');
      
      if (err.error?.message) {
        errorMessage = err.error.message;
      } else if (err.status === 400) {
        errorMessage = this.translate.instant('cannot_complete_transfer') + ': ' + (this.transfer?.status || 'Unknown status');
      }

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 5000
      });
    }
  }

  openCancelConfirm() {
    if (!this.transfer) return;
    this.cancelConfirmDialog = true;
  }

  async confirmCancel() {
    if (!this.transfer?.transferId) return;

    this.isLoading = true;
    try {
      const response = await firstValueFrom(await this.transferService.cancelTransfer(this.transfer.transferId));
      this.isLoading = false;
      this.cancelConfirmDialog = false;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('transfer_cancelled_successfully'),
        life: 3000
      });
      await this.loadTransfer();
    } catch (err: any) {
      this.isLoading = false;
      console.error('Error cancelling transfer:', err);
      let errorMessage = this.translate.instant('error_cancelling_transfer');
      
      if (err.error?.message) {
        errorMessage = err.error.message;
      } else if (err.status === 400) {
        errorMessage = this.translate.instant('cannot_cancel_completed_transfer');
      }

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 5000
      });
    }
  }

  refreshTransferDetails() {
    this.loadTransfer();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('success'),
      detail: this.translate.instant('transfer_refreshed'),
      life: 3000
    });
  }

  goBack(): void {
    this.location.back();
  }
}

