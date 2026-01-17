import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { InventoryWriteOff } from 'src/app/models/write-off';
import { WriteOffService } from 'src/app/services/write-off.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-write-off-details-page',
  templateUrl: './write-off-details-page.component.html',
  styleUrls: ['./write-off-details-page.component.css', '../write-offs.component.css']
})
export class WriteOffDetailsPageComponent implements OnInit {
  writeOffId!: number;
  writeOff: InventoryWriteOff | null = null;
  isLoading: boolean = true;
  
  canApprove: boolean = false;
  canRead: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  resource: string = 'INVENTORY_WRITE_OFFS';

  writeOffEvents: any[] = [];

  // Confirmation dialogs
  approveConfirmDialog: boolean = false;
  rejectConfirmDialog: boolean = false;
  rejectionReason: string = '';
  
  // Currency
  currency: string = 'USD';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private writeOffService: WriteOffService,
    private messageService: MessageService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private translateService: TranslationService,
    private configService: AppConfigurationService
  ) {}

  async ngOnInit() {
    this.isLoading = true;

    // Load currency
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    await this.configService.loadCurrencyOnce();

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.writeOffId = +params['id'];
      if (!this.writeOffId || isNaN(this.writeOffId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_write_off_id'),
          life: 3000
        });
        this.router.navigate(['/inventory/write-offs']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadWriteOff();
    });
  }

  async loadWriteOff(): Promise<void> {
    try {
      const response = await firstValueFrom(await this.writeOffService.getWriteOff(this.writeOffId));
      console.log('Write-off API response:', response);
      
      let writeOffData: any;
      if (Array.isArray(response)) {
        writeOffData = response[0];
      } else if (response && typeof response === 'object') {
        writeOffData = response;
      } else {
        throw new Error('Unexpected response format from API');
      }

      // Handle flat format from backend (productId, warehouseId, productName, warehouseName)
      this.writeOff = {
        ...writeOffData,
        product: writeOffData.product || (writeOffData.productId ? {
          productId: writeOffData.productId,
          name: writeOffData.productName,
          reference: writeOffData.productReference
        } : null),
        warehouse: writeOffData.warehouse || (writeOffData.warehouseId ? {
          warehouseId: writeOffData.warehouseId,
          name: writeOffData.warehouseName
        } : null),
        writeOffDate: writeOffData.writeOffDate ? new Date(writeOffData.writeOffDate) : null,
        approvedDate: writeOffData.approvedDate ? new Date(writeOffData.approvedDate) : null,
        rejectedDate: writeOffData.rejectedDate ? new Date(writeOffData.rejectedDate) : null,
        creationDate: writeOffData.creationDate ? new Date(writeOffData.creationDate) : null
      } as InventoryWriteOff;
      
      if (!this.writeOff || !this.writeOff.writeOffId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('write_off_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/write-offs']);
        return;
      }

      this.buildWriteOffTimeline(this.writeOff);
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading write-off:', error);
      this.isLoading = false;
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_loading_write_off');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 3000
      });
      setTimeout(() => {
        this.router.navigate(['/inventory/write-offs']);
      }, 2000);
    }
  }

  buildWriteOffTimeline(writeOff: InventoryWriteOff) {
    this.writeOffEvents = [];
    
    if (writeOff.creationDate) {
      this.writeOffEvents.push({
        status: 'CREATED',
        date: writeOff.creationDate,
        user: writeOff.createdBy || 'System',
        icon: 'pi pi-plus-circle',
        color: 'primary'
      });
    }

    if (writeOff.writeOffDate) {
      this.writeOffEvents.push({
        status: 'WRITTEN_OFF',
        date: writeOff.writeOffDate,
        user: writeOff.createdBy || 'System',
        icon: 'pi pi-minus-circle',
        color: 'info'
      });
    }

    if (writeOff.approvedDate) {
      this.writeOffEvents.push({
        status: 'APPROVED',
        date: writeOff.approvedDate,
        user: writeOff.approvedBy || 'System',
        icon: 'pi pi-check-circle',
        color: 'success'
      });
    }

    if (writeOff.rejectedDate) {
      this.writeOffEvents.push({
        status: 'REJECTED',
        date: writeOff.rejectedDate,
        user: writeOff.rejectedBy || 'System',
        icon: 'pi pi-times-circle',
        color: 'danger'
      });
    }
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canRead = this.permissionService.canRead(this.resource);
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
    this.canApprove = this.isAdmin || this.userRoles.includes('WRITE_OFF_APPROVE');
  }

  // Status helpers
  getStatusSeverity(status: string | undefined): string {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'PENDING') return 'warning';
    if (s === 'APPROVED') return 'success';
    if (s === 'REJECTED') return 'danger';
    return '';
  }

  getConditionSeverity(condition: string | undefined): string {
    if (!condition) return '';
    const c = condition.toUpperCase();
    if (c === 'DAMAGED' || c === 'UNUSABLE') return 'danger';
    if (c === 'LOST') return 'warn';
    if (c === 'EXPIRED') return 'info';
    return '';
  }

  getConditionLabel(condition: string | undefined): string {
    if (!condition) return 'N/A';
    const key = `item_condition_${condition.toLowerCase()}`;
    return this.translate.instant(key) || condition;
  }

  getSourceTypeLabel(sourceType: string | undefined): string {
    if (!sourceType) return 'N/A';
    const key = `write_off_source_type_${sourceType.toLowerCase().replace(/_/g, '_')}`;
    return this.translate.instant(key) || sourceType;
  }

  getReasonLabel(reason: string | undefined): string {
    if (!reason) return '-';
    // Check if reason is a predefined value (uppercase) that needs translation
    const upperReason = reason.toUpperCase().trim();
    const translationKey = `write_off_reason_${upperReason.toLowerCase()}`;
    const translated = this.translate.instant(translationKey);
    
    // If translation exists and is different from the key, use it
    if (translated && translated !== translationKey) {
      return translated;
    }
    
    // If it's a predefined reason value, try common reason translations
    if (upperReason === 'DEFECTIVE') {
      return this.translate.instant('return_reason_defective') || reason;
    }
    if (upperReason === 'INCORRECT_ITEM') {
      return this.translate.instant('return_reason_incorrect_item') || reason;
    }
    if (upperReason === 'CHANGE_OF_MIND') {
      return this.translate.instant('return_reason_change_of_mind') || reason;
    }
    if (upperReason === 'OTHER') {
      return this.translate.instant('return_reason_other') || reason;
    }
    
    // For custom reasons, return as-is
    return reason;
  }

  canApproveWriteOff(writeOff: InventoryWriteOff): boolean {
    return writeOff.status === 'PENDING' && this.canApprove;
  }

  canRejectWriteOff(writeOff: InventoryWriteOff): boolean {
    return writeOff.status === 'PENDING' && this.canApprove;
  }

  formatCurrency(amount: number | null | undefined): string {
    if (amount == null || amount === undefined || isNaN(amount)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatDate(date: Date | string | null | undefined): string {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(date);
    }
  }

  // Action Methods
  openApproveConfirm() {
    this.approveConfirmDialog = true;
  }

  async confirmApprove() {
    if (!this.writeOff?.writeOffId) return;

    this.isLoading = true;
    try {
      const response = await firstValueFrom(await this.writeOffService.approveWriteOff(this.writeOff.writeOffId));
      this.isLoading = false;
      this.approveConfirmDialog = false;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('write_off_approved_successfully'),
        life: 3000
      });
      await this.loadWriteOff();
    } catch (error: any) {
      this.isLoading = false;
      console.error('Error approving write-off:', error);
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_approving_write_off');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 5000
      });
    }
  }

  openRejectConfirm() {
    this.rejectionReason = '';
    this.rejectConfirmDialog = true;
  }

  async confirmReject() {
    if (!this.writeOff?.writeOffId) return;

    this.isLoading = true;
    try {
      const response = await firstValueFrom(await this.writeOffService.rejectWriteOff(this.writeOff.writeOffId, this.rejectionReason));
      this.isLoading = false;
      this.rejectConfirmDialog = false;
      this.rejectionReason = '';
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('write_off_rejected_successfully'),
        life: 3000
      });
      await this.loadWriteOff();
    } catch (error: any) {
      this.isLoading = false;
      console.error('Error rejecting write-off:', error);
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_rejecting_write_off');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 5000
      });
    }
  }

  refreshWriteOffDetails() {
    this.loadWriteOff();
  }

  goBack() {
    this.location.back();
  }
}

