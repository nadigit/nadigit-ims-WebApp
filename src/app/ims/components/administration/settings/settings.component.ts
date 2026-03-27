import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { TranslateService } from '@ngx-translate/core';
import { AppConfiguration } from 'src/app/models/appConfiguration';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { currencies } from 'currencies.json';
import { Bank } from 'src/app/models/bank';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute } from '@angular/router';


interface UploadEvent {
  originalEvent: Event;
  files: File[];
}

@Component({
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css', '../administration.component.css'],
  providers: [MessageService]
})
export class SettingsComponent implements OnInit {

  rowsPerPageOptions = [20, 50, 100];
  valSwitch: boolean = false;
  currenciesList: any = currencies;
  printingFormats: any;
  isEditMode = false; // Flag to track edit mode
  fields: any;
  configs: AppConfiguration[] = [];
  appConfigCurrency: any = null;
  taxPercentage: number;
  refundPercentageDamaged: number;
  refundPercentageUsed: number;
  refundPercentageNew: number;

  autoOrderCompleteChecked: boolean = false;
  timezones: any[] = Intl.supportedValuesOf('timeZone').map(tz => ({ label: tz, value: tz }));
  isLoading: boolean = true;
  isLoadingBanks: boolean = true;

  autoOrderOptions: any[] = [];
  booleanOptions: any[] = [];
  activeTabIndex: number = 0;

  // Banks properties
  banks: Bank[] = [];
  bank: Bank = {};
  selectedBanks: Bank[] = [];
  bankDialog: boolean = false;
  deleteBankDialog: boolean = false;
  deleteBanksDialog: boolean = false;
  bankDetailsDialog: boolean = false;
  submittedBank: boolean = false;
  globalFilter: string = '';
  activeFilter: boolean | undefined = undefined;
  canAddBank: boolean = false;
  canEditBank: boolean = false;
  canDeleteBank: boolean = false;
  canReadBank: boolean = false;
  Ressource: string = 'BANKS';

  // Computed properties
  get activeBanksCount(): number {
    return (this.banks || []).filter(b => b.active).length;
  }

  constructor(
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private appConfigService: AppConfigurationService,
    private translate: TranslateService,
    private bankAccountService: BankAccountService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private route: ActivatedRoute,
  ) {
  }

  goBack(): void {
    this.location.back();
  }

  navigateToEmailConfig(): void {
    this.router.navigate(['/administration/settings/email']);
  }

  navigateToNotificationRecipients(): void {
    this.router.navigate(['/administration/settings/email/recipients']);
  }

  async ngOnInit() {
    this.isLoading = true;

    const translations = await this.translate.get(['a4', 'receipt']).toPromise();

    this.printingFormats = [
      {
        label: translations['a4'],
        value: 'a4',
      },
      {
        label: translations['receipt'],
        value: 'receipt',
      },
    ];

    this.loadConfigs();
    await this.checkBankPermissions();
    await this.loadBanks();

    // Options for auto order completion (enabled / disabled)
    this.autoOrderOptions = [
      { label: this.translate.instant('enabled'), value: 'active' },
      { label: this.translate.instant('disabled'), value: 'inactive' }
    ];

    // Options for boolean settings (true/false)
    this.booleanOptions = [
      { label: this.translate.instant('enabled'), value: 'true' },
      { label: this.translate.instant('disabled'), value: 'false' }
    ];

    // Check if we need to open banks tab from query params
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'banks') {
        this.activeTabIndex = 1;
      }
    });
  }

  // Helper method to parse float values in templates
  parseFloat(value: string | number): number {
    if (typeof value === 'number') return value;
    return parseFloat(String(value)) || 0;
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  clear(table: Table) {
    table.clear();
  }

  toggleEditMode(field: AppConfiguration) {
    if (field.isEditing) {
      this.saveConfig(field);
    }
    field.isEditing = !field.isEditing; // Toggle edit mode for the clicked field
    this.configs = [...this.configs]; // Create a new array reference to trigger change detection
  }

  async loadConfigs(): Promise<void> {
    try {
      (await this.appConfigService.getAllConfigurations()).subscribe({
        next: (params: AppConfiguration[]) => {
          // Only keep non-editable configs and exclude email-related configurations
          const nonEditableConfigs = params.filter(config => 
            config.editable && !config.key?.startsWith('email.')
          );

          this.configs = nonEditableConfigs.sort((a, b) => a.id - b.id);

          // Find tax config (if you need it even if editable, use original list `params`)
          const taxConfig = params.find(config => config.key === 'tax');
          const autoOrderComplete = params.find(config => config.key === 'autoOrderComplete');

          if (taxConfig) {
            this.taxPercentage = parseFloat(taxConfig.value) * 100;
          }

          // Initialize refund percentages
          const refundDamagedConfig = params.find(config => config.key === 'return.refund.percentage.damaged');
          if (refundDamagedConfig) {
            this.refundPercentageDamaged = parseFloat(refundDamagedConfig.value) * 100;
          }

          const refundUsedConfig = params.find(config => config.key === 'return.refund.percentage.used');
          if (refundUsedConfig) {
            this.refundPercentageUsed = parseFloat(refundUsedConfig.value) * 100;
          }

          const refundNewConfig = params.find(config => config.key === 'return.refund.percentage.new');
          if (refundNewConfig) {
            this.refundPercentageNew = parseFloat(refundNewConfig.value) * 100;
          }

          if (autoOrderComplete) {
            this.autoOrderCompleteChecked = autoOrderComplete.value === 'active';
          }

          this.appConfigCurrency = params.find(config => config.key === 'currency');

          console.log('Non-editable configs:', this.configs);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading configurations:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_configurations'),
            life: 3000
          });
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Error loading configurations:', error);
      this.isLoading = false;
    }
  }


  trackByConfig(index: number, config: AppConfiguration): number {
    return config.id; // or config.key if that's unique
  }

  getPrintingFormatLabel(value: string): string {
    const format = this.printingFormats.find(f => f.value === value);
    return format ? format.label : value;
  }

  saveConfig(field: AppConfiguration) {
    console.log(field);
    delete field.isEditing;
    console.log(field);
    const config = this.configs.find(c => c.key === field.key);
    console.log(config);
    if (config) {
      config.value = field.value;
      this.updateConfig(config);
    }
  }



  async updateConfig(config: AppConfiguration): Promise<void> {
    console.log(config);
    (await this.appConfigService.saveConfiguration(config)).subscribe({
      next: (response: AppConfiguration) => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('configuration_updated'),
          life: 3000
        });
        this.loadConfigs();
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_updating_configuration'),
          life: 3000
        });
      }
    });
  }

  onTaxChange(value: number) {
    // Convert percentage (e.g., 20) back to decimal (e.g., 0.2) and update the config value
    const taxConfig = this.configs.find(config => config.key === 'tax');
    if (taxConfig) {
      // Convert the result back to string and update the value
      taxConfig.value = (value / 100).toString();
    }
  }

  onRefundPercentageChange(value: number, configKey: string) {
    // Convert percentage (e.g., 50) back to decimal (e.g., 0.5) and update the config value
    const refundConfig = this.configs.find(config => config.key === configKey);
    if (refundConfig) {
      // Convert the result back to string and update the value
      refundConfig.value = (value / 100).toString();
    }
  }

  // Banks methods
  async checkBankPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      await this.permissionService.init(userId).toPromise();
      this.canAddBank = this.permissionService.canCreate(this.Ressource);
      this.canEditBank = this.permissionService.canUpdate(this.Ressource);
      this.canDeleteBank = this.permissionService.canDelete(this.Ressource);
      this.canReadBank = this.permissionService.canRead(this.Ressource);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  async loadBanks() {
    this.isLoadingBanks = true;
    try {
      const response = await firstValueFrom(await this.bankAccountService.getBanks(this.activeFilter));
      this.banks = response || [];
    } catch (error) {
      console.error('Error loading banks:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_banks'),
        life: 3000
      });
    } finally {
      this.isLoadingBanks = false;
    }
  }

  openNewBank() {
    if (!this.canAddBank) return;
    this.bank = {};
    this.submittedBank = false;
    this.bankDialog = true;
  }

  editBank(bank: Bank) {
    if (!this.canEditBank) return;
    this.bank = { ...bank };
    this.bankDialog = true;
    this.submittedBank = false;
  }

  deleteBank(bank: Bank) {
    if (!this.canDeleteBank) return;
    this.bank = { ...bank };
    this.deleteBankDialog = true;
  }

  deleteSelectedBanks() {
    if (!this.canDeleteBank) return;
    this.deleteBanksDialog = true;
  }

  async confirmDeleteBank() {
    this.deleteBankDialog = false;
    try {
      await firstValueFrom(await this.bankAccountService.deleteBank(this.bank.bankId!));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('bank_deleted'),
        life: 3000
      });
      await this.loadBanks();
      this.bank = {};
    } catch (error: any) {
      console.error('Error deleting bank:', error);
      const errorMsg = error?.error?.message || this.translate.instant('error_deleting_bank');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMsg,
        life: 3000
      });
    }
  }

  async confirmDeleteSelectedBanks() {
    this.deleteBanksDialog = false;
    const deletePromises = this.selectedBanks.map(async bank => {
      const observable$ = await this.bankAccountService.deleteBank(bank.bankId!);
      return firstValueFrom(observable$);
    });
    
    try {
      await Promise.all(deletePromises);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('banks_deleted'),
        life: 3000
      });
      this.selectedBanks = [];
      await this.loadBanks();
    } catch (error) {
      console.error('Error deleting banks:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_deleting_banks'),
        life: 3000
      });
    }
  }

  hideBankDialog() {
    this.bankDialog = false;
    this.submittedBank = false;
    this.bank = {};
  }

  async saveBank() {
    this.submittedBank = true;

    if (!this.bank.name || this.bank.name.trim() === '') {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('bank_name_required'),
        life: 3000
      });
      return;
    }

    if (this.bank.email && !this.isValidEmail(this.bank.email)) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_email_format'),
        life: 3000
      });
      return;
    }

    if (this.bank.website && !this.isValidUrl(this.bank.website)) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_url_format'),
        life: 3000
      });
      return;
    }

    try {
      if (this.bank.bankId) {
        await firstValueFrom(await this.bankAccountService.updateBank(this.bank.bankId, this.bank));
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('bank_updated_successfully'),
          life: 3000
        });
      } else {
        await firstValueFrom(await this.bankAccountService.createBank(this.bank));
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('bank_created_successfully'),
          life: 3000
        });
      }
      this.bankDialog = false;
      this.bank = {};
      await this.loadBanks();
    } catch (error: any) {
      console.error('Error saving bank:', error);
      const errorMsg = error?.error?.message || this.translate.instant('error_saving_bank');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMsg,
        life: 3000
      });
    }
  }

  viewBankDetails(bank: Bank) {
    if (!this.canReadBank) return;
    this.bank = { ...bank };
    this.bankDetailsDialog = true;
  }

  async onActiveFilterChange() {
    await this.loadBanks();
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

}
