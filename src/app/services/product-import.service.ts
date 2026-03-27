import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { Observable, firstValueFrom } from 'rxjs';
import { ImportOptions, ImportValidationResult, ImportPreview, ImportResult } from '../models/product-import.model';
import { withAudit } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class ProductImportService {
  jwt: any;
  schema: string = "/api/products/import/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService
  ) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  private getHeaders(): HttpHeaders {
    this.loadToken();
    return new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
  }

  private getBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  /**
   * Download CSV template
   */
  downloadCsvTemplate(): Observable<Blob> {
    const headers = this.getHeaders();
    return this.http.get(`${this.getBaseUrl()}template/csv`, {
      headers: headers,
      responseType: 'blob'
    });
  }

  /**
   * Download Excel template
   */
  downloadExcelTemplate(): Observable<Blob> {
    const headers = this.getHeaders();
    return this.http.get(`${this.getBaseUrl()}template/excel`, {
      headers: headers,
      responseType: 'blob'
    });
  }

  /**
   * Validate import file
   */
  validateFile(file: File, options: ImportOptions = {}): Observable<ImportValidationResult> {
    const headers = this.getHeaders();
    const formData = new FormData();
    formData.append('file', file);
    
    // Add options to form data
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    return this.http.post<ImportValidationResult>(
      `${this.getBaseUrl()}validate`,
      formData,
      { headers: headers }
    );
  }

  /**
   * Preview import
   */
  previewImport(file: File, previewRows: number = 10, options: ImportOptions = {}): Observable<ImportPreview> {
    const headers = this.getHeaders();
    const formData = new FormData();
    formData.append('file', file);
    
    // Add options to form data
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const params = new HttpParams().set('previewRows', previewRows.toString());

    return this.http.post<ImportPreview>(
      `${this.getBaseUrl()}preview`,
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
  executeImport(file: File, options: ImportOptions = {}): Observable<ImportResult> {
    const headers = withAudit(this.getHeaders(), 'Imported products from file');
    const formData = new FormData();
    formData.append('file', file);
    
    // Add options to form data
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    return this.http.post<ImportResult>(
      `${this.getBaseUrl()}execute`,
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
        ? this.downloadCsvTemplate() 
        : this.downloadExcelTemplate();
      
      const blob = await firstValueFrom(observable);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `product_import_template.${format === 'csv' ? 'csv' : 'xlsx'}`;
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
    a.download = `import_errors_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

