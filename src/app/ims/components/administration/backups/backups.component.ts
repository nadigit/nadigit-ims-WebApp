import { Component, OnDestroy, OnInit, Inject } from '@angular/core';
import { Location } from '@angular/common';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subscription, interval } from 'rxjs';
import { BackupConfig, BackupJob } from 'src/app/models/backup';
import { MaintenanceStatus } from 'src/app/models/maintenance';
import { RestoreConfig, RestoreJob, RestoreRequest, RestoreSettings } from 'src/app/models/restore';
import { BackupService } from 'src/app/services/backup.service';
import { MaintenanceService } from 'src/app/services/maintenance.service';
import { RestoreService } from 'src/app/services/restore.service';

@Component({
  templateUrl: './backups.component.html',
  styleUrls: ['./backups.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class BackupsComponent implements OnInit, OnDestroy {
  backups: BackupJob[] = [];
  config: BackupConfig | null = null;
  selectedJob: BackupJob | null = null;
  backupOptions: { label: string; value: BackupJob }[] = [];

  isLoadingBackups = false;
  isLoadingConfig = false;
  isCreating = false;
  pollingActive = false;

  restoreConfig: RestoreConfig | null = null;
  restoreSettings: RestoreSettings | null = null;
  restoreJobs: RestoreJob[] = [];
  selectedRestoreJob: RestoreJob | null = null;
  selectedRestoreBackup: BackupJob | null = null;

  restoreForm = {
    restoreDatabase: true,
    restoreFiles: true,
    fileMode: 'OVERWRITE',
    createSafetyBackup: true,
    confirmPhrase: ''
  };

  maintenanceStatus: MaintenanceStatus | null = null;
  maintenanceMessage = '';
  isLoadingMaintenance = false;
  isUpdatingMaintenance = false;

  isLoadingRestoreConfig = false;
  isLoadingRestoreSettings = false;
  isLoadingRestoreJobs = false;
  isUpdatingRestoreSettings = false;
  isRestoring = false;
  restorePollingActive = false;

  detailsDialog = false;
  private pollingSub?: Subscription;
  private restorePollingSub?: Subscription;

  constructor(
    private backupService: BackupService,
    private restoreService: RestoreService,
    @Inject(MaintenanceService) private maintenanceService: MaintenanceService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private location: Location
  ) { }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadConfig(),
      this.loadBackups(),
      this.loadMaintenanceStatus(),
      this.loadRestoreConfig(),
      this.loadRestoreSettings(),
      this.loadRestoreJobs()
    ]);
    if (this.hasRunningJobs()) {
      this.startPolling();
    }
    if (this.hasRunningRestoreJobs()) {
      this.startRestorePolling();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.stopRestorePolling();
  }

  goBack(): void {
    this.location.back();
  }

  async loadConfig(): Promise<void> {
    this.isLoadingConfig = true;
    try {
      const config$ = await this.backupService.getConfig();
      this.config = await firstValueFrom(config$);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_backup_config'),
        life: 4000
      });
    } finally {
      this.isLoadingConfig = false;
    }
  }

  async loadBackups(showError = true): Promise<void> {
    this.isLoadingBackups = true;
    try {
      const backups$ = await this.backupService.listBackups();
      this.backups = (await firstValueFrom(backups$)) || [];
      this.updateBackupOptions();
    } catch (error) {
      if (showError) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_backups'),
          life: 4000
        });
      }
    } finally {
      this.isLoadingBackups = false;
    }
  }

  async loadMaintenanceStatus(): Promise<void> {
    this.isLoadingMaintenance = true;
    try {
      const status$ = await this.maintenanceService.getStatus();
      this.maintenanceStatus = await firstValueFrom(status$);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_maintenance_status'),
        life: 4000
      });
    } finally {
      this.isLoadingMaintenance = false;
    }
  }

  async loadRestoreConfig(): Promise<void> {
    this.isLoadingRestoreConfig = true;
    try {
      const config$ = await this.restoreService.getConfig();
      this.restoreConfig = await firstValueFrom(config$);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_restore_config'),
        life: 4000
      });
    } finally {
      this.isLoadingRestoreConfig = false;
    }
  }

  async loadRestoreSettings(): Promise<void> {
    this.isLoadingRestoreSettings = true;
    try {
      const settings$ = await this.restoreService.getSettings();
      this.restoreSettings = await firstValueFrom(settings$);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_restore_settings'),
        life: 4000
      });
    } finally {
      this.isLoadingRestoreSettings = false;
    }
  }

  async loadRestoreJobs(showError = true): Promise<void> {
    this.isLoadingRestoreJobs = true;
    try {
      const restores$ = await this.restoreService.listRestores();
      this.restoreJobs = (await firstValueFrom(restores$)) || [];
    } catch (error) {
      if (showError) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_restore_jobs'),
          life: 4000
        });
      }
    } finally {
      this.isLoadingRestoreJobs = false;
    }
  }

  async refresh(): Promise<void> {
    await this.loadBackups();
    await this.loadMaintenanceStatus();
    await this.loadRestoreSettings();
    await this.loadRestoreJobs(false);
    if (!this.hasRunningJobs()) {
      this.stopPolling();
    }
    if (!this.hasRunningRestoreJobs()) {
      this.stopRestorePolling();
    }
  }

  async triggerFullBackup(): Promise<void> {
    if (this.config && !this.config.enabled) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('backups_disabled'),
        life: 4000
      });
      return;
    }

    this.isCreating = true;
    try {
      const job$ = await this.backupService.triggerFullBackup();
      const job = await firstValueFrom(job$);
      if (job) {
        this.backups = [job, ...this.backups];
        this.updateBackupOptions();
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('backup_created'),
        life: 3000
      });
      this.startPolling();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_triggering_backup'),
        life: 4000
      });
    } finally {
      this.isCreating = false;
    }
  }

  confirmDelete(job: BackupJob): void {
    this.confirmationService.confirm({
      header: this.translate.instant('backup_delete_title'),
      message: this.translate.instant('backup_delete_confirm'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteBackup(job)
    });
  }

  async deleteBackup(job: BackupJob): Promise<void> {
    try {
      const delete$ = await this.backupService.deleteBackup(job.id);
      await firstValueFrom(delete$);
      this.backups = this.backups.filter(b => b.id !== job.id);
      this.updateBackupOptions();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('backup_deleted'),
        life: 3000
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_deleting_backup'),
        life: 4000
      });
    }
  }

  async download(job: BackupJob): Promise<void> {
    if (job.status !== 'SUCCESS') {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('download_unavailable'),
        life: 3000
      });
      return;
    }

    try {
      const response$ = await this.backupService.downloadBackup(job.id);
      const response = await firstValueFrom(response$);
      const filename = this.getFilenameFromResponse(response, job.id);
      const blob = response.body as Blob;
      if (!blob) {
        throw new Error('No download payload');
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_downloading_backup'),
        life: 4000
      });
    }
  }

  openDetails(job: BackupJob): void {
    this.selectedJob = job;
    this.selectedRestoreJob = null;
    this.detailsDialog = true;
  }

  openRestoreDetails(job: RestoreJob): void {
    this.selectedJob = null;
    this.selectedRestoreJob = job;
    this.detailsDialog = true;
  }

  async startRestore(): Promise<void> {
    if (!this.selectedRestoreBackup) {
      return;
    }
    if (!this.isRestoreEnabled()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.getRestoreDisabledMessage(),
        life: 4000
      });
      return;
    }
    if (!this.maintenanceStatus?.enabled) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('maintenance_required_for_restore'),
        life: 4000
      });
      return;
    }
    if (!this.isConfirmPhraseValid()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('restore_confirm_phrase_invalid'),
        life: 3500
      });
      return;
    }

    this.isRestoring = true;
    try {
      const payload: RestoreRequest = {
        restoreDatabase: this.restoreForm.restoreDatabase,
        restoreFiles: this.restoreForm.restoreFiles,
        fileMode: this.restoreForm.fileMode as 'OVERWRITE' | 'KEEP_OLD_FILES',
        createSafetyBackup: this.restoreForm.createSafetyBackup,
        confirmPhrase: this.restoreForm.confirmPhrase,
        expectedSha256: this.selectedRestoreBackup.checksumSha256 || null
      };
      const restore$ = await this.restoreService.triggerRestore(this.selectedRestoreBackup.id, payload);
      const job = await firstValueFrom(restore$);
      if (job) {
        this.restoreJobs = [job, ...this.restoreJobs];
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('restore_started'),
        life: 3000
      });
      this.startRestorePolling();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_starting_restore'),
        life: 4000
      });
    } finally {
      this.isRestoring = false;
    }
  }

  confirmEnableRestore(): void {
    this.confirmationService.confirm({
      header: this.translate.instant('restore_enable_title'),
      message: this.translate.instant('restore_enable_confirm'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.updateRestoreSettings(true)
    });
  }

  confirmDisableRestore(): void {
    this.confirmationService.confirm({
      header: this.translate.instant('restore_disable_title'),
      message: this.translate.instant('restore_disable_confirm'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.updateRestoreSettings(false)
    });
  }

  async updateRestoreSettings(enabled: boolean): Promise<void> {
    this.isUpdatingRestoreSettings = true;
    try {
      const settings$ = await this.restoreService.updateSettings(enabled);
      this.restoreSettings = await firstValueFrom(settings$);
      await this.loadRestoreConfig();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: enabled
          ? this.translate.instant('restore_enabled')
          : this.translate.instant('restore_disabled_success'),
        life: 3000
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_updating_restore_settings'),
        life: 4000
      });
    } finally {
      this.isUpdatingRestoreSettings = false;
    }
  }

  onRestoreBackupChange(backup: BackupJob | null): void {
    this.selectedRestoreBackup = backup;
    this.restoreForm.confirmPhrase = '';
  }

  copyConfirmPhrase(): void {
    const phrase = this.getExpectedConfirmPhrase();
    if (!phrase) {
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(phrase).then(() => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('confirm_phrase_copied'),
          life: 2000
        });
      });
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = phrase;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('confirm_phrase_copied'),
      life: 2000
    });
  }

  confirmEnableMaintenance(): void {
    this.confirmationService.confirm({
      header: this.translate.instant('maintenance_enable_title'),
      message: this.translate.instant('maintenance_enable_confirm'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.enableMaintenance()
    });
  }

  async enableMaintenance(): Promise<void> {
    this.isUpdatingMaintenance = true;
    try {
      const payload = this.maintenanceMessage?.trim()
        ? { message: this.maintenanceMessage.trim() }
        : { message: null };
      const status$ = await this.maintenanceService.enableMaintenance(payload);
      this.maintenanceStatus = await firstValueFrom(status$);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('maintenance_enabled'),
        life: 3000
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_enabling_maintenance'),
        life: 4000
      });
    } finally {
      this.isUpdatingMaintenance = false;
    }
  }

  confirmDisableMaintenance(): void {
    this.confirmationService.confirm({
      header: this.translate.instant('maintenance_disable_title'),
      message: this.translate.instant('maintenance_disable_confirm'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.disableMaintenance()
    });
  }

  async disableMaintenance(): Promise<void> {
    this.isUpdatingMaintenance = true;
    try {
      const status$ = await this.maintenanceService.disableMaintenance();
      this.maintenanceStatus = await firstValueFrom(status$);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('maintenance_disabled'),
        life: 3000
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_disabling_maintenance'),
        life: 4000
      });
    } finally {
      this.isUpdatingMaintenance = false;
    }
  }

  getExpectedConfirmPhrase(): string {
    if (!this.selectedRestoreBackup) {
      return '';
    }
    const format = this.restoreConfig?.confirmPhraseFormat || 'RESTORE_BACKUP_<backupId>';
    return format.replace('<backupId>', String(this.selectedRestoreBackup.id));
  }

  isRestoreEnabled(): boolean {
    if (!this.restoreSettings) {
      return false;
    }
    const masterEnabled = this.restoreSettings.serverMasterEnabled;
    const settingsEnabled = this.restoreSettings.enabled;
    const configEnabled = this.restoreConfig?.enabled ?? false;
    return masterEnabled && settingsEnabled && configEnabled;
  }

  getRestoreDisabledMessage(): string {
    if (!this.restoreSettings?.serverMasterEnabled) {
      return this.translate.instant('restore_disabled_server_master');
    }
    if (!this.restoreSettings?.enabled) {
      return this.translate.instant('restore_disabled_message');
    }
    if (this.restoreConfig && !this.restoreConfig.enabled) {
      return this.translate.instant('restore_disabled');
    }
    return this.translate.instant('restore_disabled_message');
  }

  isConfirmPhraseValid(): boolean {
    if (!this.restoreConfig?.requiresConfirmPhrase) {
      return true;
    }
    const expected = this.getExpectedConfirmPhrase();
    return !!expected && this.restoreForm.confirmPhrase.trim() === expected;
  }

  hasRunningRestoreJobs(): boolean {
    return this.restoreJobs.some(job => job.status === 'PENDING' || job.status === 'RUNNING');
  }

  startRestorePolling(): void {
    if (this.restorePollingSub) {
      return;
    }
    this.restorePollingActive = true;
    this.restorePollingSub = interval(3000).subscribe(async () => {
      await this.loadRestoreJobs(false);
      if (!this.hasRunningRestoreJobs()) {
        this.stopRestorePolling();
      }
    });
  }

  stopRestorePolling(): void {
    if (this.restorePollingSub) {
      this.restorePollingSub.unsubscribe();
      this.restorePollingSub = undefined;
    }
    this.restorePollingActive = false;
  }

  getStatusSeverity(status: BackupJob['status']): 'success' | 'warning' | 'danger' | 'info' {
    switch (status) {
      case 'SUCCESS':
        return 'success';
      case 'FAILED':
        return 'danger';
      case 'RUNNING':
        return 'info';
      case 'PENDING':
      default:
        return 'warning';
    }
  }

  getStatusLabel(status: BackupJob['status']): string {
    return this.translate.instant(`backup_status_${status.toLowerCase()}`);
  }

  getRestoreStatusSeverity(status: RestoreJob['status']): 'success' | 'warning' | 'danger' | 'info' {
    switch (status) {
      case 'SUCCESS':
        return 'success';
      case 'FAILED':
        return 'danger';
      case 'RUNNING':
        return 'info';
      case 'PENDING':
      default:
        return 'warning';
    }
  }

  getRestoreStatusLabel(status: RestoreJob['status']): string {
    return this.translate.instant(`restore_status_${status.toLowerCase()}`);
  }

  getRollbackLabel(job: RestoreJob): string {
    if (!job.rollbackAttempted) {
      return this.translate.instant('rollback_not_attempted');
    }
    if (job.rollbackSucceeded) {
      return this.translate.instant('rollback_success');
    }
    return this.translate.instant('rollback_failed');
  }

  hasRunningJobs(): boolean {
    return this.backups.some(job => job.status === 'PENDING' || job.status === 'RUNNING');
  }

  startPolling(): void {
    if (this.pollingSub) {
      return;
    }
    this.pollingActive = true;
    this.pollingSub = interval(3000).subscribe(async () => {
      await this.loadBackups(false);
      if (!this.hasRunningJobs()) {
        this.stopPolling();
      }
    });
  }

  stopPolling(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
      this.pollingSub = undefined;
    }
    this.pollingActive = false;
  }

  private updateBackupOptions(): void {
    this.backupOptions = this.backups
      .filter(job => job.status === 'SUCCESS')
      .map(job => ({
        label: `#${job.id} • ${job.createdAt ? new Date(job.createdAt).toLocaleString() : '-'}`,
        value: job
      }));
    if (this.selectedRestoreBackup) {
      const stillExists = this.backupOptions.some(option => option.value.id === this.selectedRestoreBackup?.id);
      if (!stillExists) {
        this.selectedRestoreBackup = null;
        this.restoreForm.confirmPhrase = '';
      }
    }
  }

  formatBytes(bytes?: number): string {
    if (!bytes && bytes !== 0) {
      return '-';
    }
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(2)} ${units[i]}`;
  }

  private getFilenameFromResponse(response: any, id: number): string {
    const contentDisposition = response?.headers?.get('Content-Disposition') || response?.headers?.get('content-disposition');
    if (contentDisposition) {
      const filenameMatch = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(contentDisposition);
      const filename = filenameMatch?.[1] || filenameMatch?.[2] || filenameMatch?.[3];
      if (filename) {
        return decodeURIComponent(filename.replace(/['"]/g, '').trim());
      }
    }
    return `backup-${id}.tar.gz`;
  }
}
