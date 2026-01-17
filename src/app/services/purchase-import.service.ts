import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { Observable, firstValueFrom } from 'rxjs';
import { PurchaseImportOptions, ImportValidationResult, PurchaseImportPreview, PurchaseImportResult, ParsedInvoiceData } from '../models/purchase-import.model';

@Injectable({
  providedIn: 'root'
})
export class PurchaseImportService {
  jwt: any;
  schema: string = "/api/purchases/import";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService
  ) { }

  private async getHeaders(): Promise<HttpHeaders> {
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
    return new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
  }

  private getBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  /**
   * Download CSV template
   */
  async downloadCsvTemplate(): Promise<Observable<Blob>> {
    const headers = await this.getHeaders();
    return this.http.get(`${this.getBaseUrl()}/template/csv`, {
      headers: headers,
      responseType: 'blob'
    });
  }

  /**
   * Download Excel template
   */
  async downloadExcelTemplate(): Promise<Observable<Blob>> {
    const headers = await this.getHeaders();
    return this.http.get(`${this.getBaseUrl()}/template/excel`, {
      headers: headers,
      responseType: 'blob'
    });
  }

  /**
   * Build FormData with file and options
   */
  private buildFormData(file: File, options: PurchaseImportOptions): FormData {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options.skipDuplicates !== undefined) formData.append('skipDuplicates', String(options.skipDuplicates));
    if (options.updateExisting !== undefined) formData.append('updateExisting', String(options.updateExisting));
    if (options.createMissingSuppliers !== undefined) formData.append('createMissingSuppliers', String(options.createMissingSuppliers));
    if (options.createMissingProducts !== undefined) formData.append('createMissingProducts', String(options.createMissingProducts));
    if (options.defaultShopId !== undefined && options.defaultShopId !== null) formData.append('defaultShopId', String(options.defaultShopId));
    if (options.groupByInvoice !== undefined) formData.append('groupByInvoice', String(options.groupByInvoice));
    if (options.groupBySupplierAndDate !== undefined) formData.append('groupBySupplierAndDate', String(options.groupBySupplierAndDate));
    if (options.validateInvoiceUniqueness !== undefined) formData.append('validateInvoiceUniqueness', String(options.validateInvoiceUniqueness));
    if (options.batchSize !== undefined) formData.append('batchSize', String(options.batchSize));
    if (options.stopOnFirstError !== undefined) formData.append('stopOnFirstError', String(options.stopOnFirstError));
    
    return formData;
  }

  /**
   * Validate import file
   */
  async validateImportFile(file: File, options: PurchaseImportOptions = {}): Promise<Observable<ImportValidationResult>> {
    const headers = await this.getHeaders();
    const formData = this.buildFormData(file, options);

    return this.http.post<ImportValidationResult>(
      `${this.getBaseUrl()}/validate`,
      formData,
      { headers: headers }
    );
  }

  /**
   * Preview import
   */
  async previewImport(file: File, previewRows: number = 10, options: PurchaseImportOptions = {}): Promise<Observable<PurchaseImportPreview>> {
    const headers = await this.getHeaders();
    const formData = this.buildFormData(file, options);
    const params = new HttpParams().set('previewRows', previewRows.toString());

    return this.http.post<PurchaseImportPreview>(
      `${this.getBaseUrl()}/preview`,
      formData,
      { 
        headers: headers,
        params: params
      }
    );
  }

  /**
   * Execute import
   */
  async executeImport(file: File, options: PurchaseImportOptions = {}): Promise<Observable<PurchaseImportResult>> {
    const headers = await this.getHeaders();
    const formData = this.buildFormData(file, options);

    return this.http.post<PurchaseImportResult>(
      `${this.getBaseUrl()}/execute`,
      formData,
      { headers: headers }
    );
  }

  /**
   * Helper method to download template file
   */
  async downloadTemplate(format: 'csv' | 'excel'): Promise<void> {
    try {
      const observable = format === 'csv' 
        ? await this.downloadCsvTemplate() 
        : await this.downloadExcelTemplate();
      
      const blob = await firstValueFrom(observable);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `purchase_import_template.${format === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      throw error;
    }
  }

  /**
   * Generate error report CSV
   */
  generateErrorReport(errors: any[]): string {
    const headers = ['Row Number', 'Column', 'Error Message', 'Invalid Value', 'Severity'];
    const rows = errors.map(err => [
      err.rowNumber?.toString() || '',
      err.column || '',
      err.message || '',
      err.invalidValue || '',
      err.severity || ''
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  /**
   * Download error report
   */
  downloadErrorReport(errors: any[]): void {
    const csv = this.generateErrorReport(errors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase_import_errors_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Phase 2: Parse invoice document
   */
  async parseInvoice(file: File, preferredLanguage?: string): Promise<Observable<ParsedInvoiceData>> {
    const headers = await this.getHeaders();
    const formData = new FormData();
    formData.append('file', file);
    if (preferredLanguage) {
      formData.append('preferredLanguage', preferredLanguage);
    }

    return this.http.post<ParsedInvoiceData>(
      `${this.getBaseUrl()}/parse-invoice`,
      formData,
      { headers: headers }
    );
  }

  /**
   * Phase 2: Preview parsed invoice
   */
  async previewParsedInvoice(
    file: File,
    productMappings: Record<string, string> = {},
    options: PurchaseImportOptions = {}
  ): Promise<Observable<PurchaseImportPreview>> {
    const headers = await this.getHeaders();
    const formData = new FormData();
    formData.append('file', file);

    // Add product mappings as JSON
    if (productMappings && Object.keys(productMappings).length > 0) {
      formData.append('productMappings', JSON.stringify(productMappings));
    }

    // Add options
    if (options.skipDuplicates !== undefined) formData.append('skipDuplicates', String(options.skipDuplicates));
    if (options.createMissingSuppliers !== undefined) formData.append('createMissingSuppliers', String(options.createMissingSuppliers));
    if (options.createMissingProducts !== undefined) formData.append('createMissingProducts', String(options.createMissingProducts));
    if (options.defaultShopId !== undefined && options.defaultShopId !== null) formData.append('defaultShopId', String(options.defaultShopId));
    if (options.autoMatchProducts !== undefined) formData.append('autoMatchProducts', String(options.autoMatchProducts));
    if (options.productMatchThreshold !== undefined) formData.append('productMatchThreshold', String(options.productMatchThreshold));
    if (options.preferredLanguage) formData.append('preferredLanguage', options.preferredLanguage);

    return this.http.post<PurchaseImportPreview>(
      `${this.getBaseUrl()}/preview-parsed-invoice`,
      formData,
      { headers: headers }
    );
  }

  /**
   * Phase 2: Import from invoice
   */
  async importFromInvoice(
    file: File,
    productMappings: Record<string, string> = {},
    options: PurchaseImportOptions = {}
  ): Promise<Observable<PurchaseImportResult>> {
    const headers = await this.getHeaders();
    const formData = new FormData();
    formData.append('file', file);

    // Add product mappings as JSON
    if (productMappings && Object.keys(productMappings).length > 0) {
      formData.append('productMappings', JSON.stringify(productMappings));
    }

    // Add options
    if (options.skipDuplicates !== undefined) formData.append('skipDuplicates', String(options.skipDuplicates));
    if (options.createMissingSuppliers !== undefined) formData.append('createMissingSuppliers', String(options.createMissingSuppliers));
    if (options.createMissingProducts !== undefined) formData.append('createMissingProducts', String(options.createMissingProducts));
    if (options.defaultShopId !== undefined && options.defaultShopId !== null) formData.append('defaultShopId', String(options.defaultShopId));
    if (options.autoMatchProducts !== undefined) formData.append('autoMatchProducts', String(options.autoMatchProducts));
    if (options.productMatchThreshold !== undefined) formData.append('productMatchThreshold', String(options.productMatchThreshold));
    if (options.preferredLanguage) formData.append('preferredLanguage', options.preferredLanguage);

    return this.http.post<PurchaseImportResult>(
      `${this.getBaseUrl()}/import-from-invoice`,
      formData,
      { headers: headers }
    );
  }
}

