import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { Observable, map } from 'rxjs';
import { 
  BarcodeRequestDTO, 
  BarcodeResponseDTO, 
  BarcodeScanResultDTO,
  BarcodeType,
  BarcodeFormat,
  BarcodeFormatOption
} from '../models/barcode';

@Injectable({
  providedIn: 'root'
})
export class BarcodeService {

  private jwt: any;
  private schema: string = "/api/barcodes";
  private apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  private apiHost: string = (window as any).__env.apiHost || 'localhost';
  private apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    public keycloakService: KeycloakService
  ) { }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
  }

  private getBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  // ==================== BARCODE CRUD OPERATIONS ====================

  /**
   * Generate a new barcode for a product
   * POST /api/barcodes
   */
  generateBarcode(request: BarcodeRequestDTO): Observable<BarcodeResponseDTO> {
    const url = this.getBaseUrl();
    return this.http.post<BarcodeResponseDTO>(url, request, { headers: this.getHeaders() });
  }

  /**
   * Auto-generate barcode with default settings
   * POST /api/barcodes/{productId}/auto?type=BARCODE
   */
  autoGenerateBarcode(productId: number, type: BarcodeType = 'BARCODE'): Observable<BarcodeResponseDTO> {
    const url = `${this.getBaseUrl()}/${productId}/auto`;
    const params = new HttpParams().set('type', type);
    return this.http.post<BarcodeResponseDTO>(url, null, { headers: this.getHeaders(), params });
  }

  /**
   * Get all barcodes for a product
   * GET /api/barcodes/product/{productId}
   */
  getProductBarcodes(productId: number): Observable<BarcodeResponseDTO[]> {
    const url = `${this.getBaseUrl()}/product/${productId}`;
    return this.http.get<BarcodeResponseDTO[]>(url, { headers: this.getHeaders() });
  }

  /**
   * Get barcode by ID
   * GET /api/barcodes/{id}
   */
  getBarcode(barcodeId: number): Observable<BarcodeResponseDTO> {
    const url = `${this.getBaseUrl()}/${barcodeId}`;
    return this.http.get<BarcodeResponseDTO>(url, { headers: this.getHeaders() });
  }

  /**
   * Update barcode
   * PUT /api/barcodes/{id}
   */
  updateBarcode(barcodeId: number, request: Partial<BarcodeRequestDTO>): Observable<BarcodeResponseDTO> {
    const url = `${this.getBaseUrl()}/${barcodeId}`;
    return this.http.put<BarcodeResponseDTO>(url, request, { headers: this.getHeaders() });
  }

  /**
   * Delete barcode
   * DELETE /api/barcodes/{id}
   */
  deleteBarcode(barcodeId: number): Observable<void> {
    const url = `${this.getBaseUrl()}/${barcodeId}`;
    return this.http.delete<void>(url, { headers: this.getHeaders() });
  }

  /**
   * Set barcode as primary
   * PUT /api/barcodes/{id}/set-primary
   */
  setPrimaryBarcode(barcodeId: number): Observable<BarcodeResponseDTO> {
    const url = `${this.getBaseUrl()}/${barcodeId}/set-primary`;
    return this.http.put<BarcodeResponseDTO>(url, null, { headers: this.getHeaders() });
  }

  // ==================== SCANNING ====================

  /**
   * Scan barcode and get product details
   * GET /api/barcodes/scan/{value}
   */
  scanBarcode(barcodeValue: string): Observable<BarcodeScanResultDTO> {
    const url = `${this.getBaseUrl()}/scan/${encodeURIComponent(barcodeValue)}`;
    return this.http.get<BarcodeScanResultDTO>(url, { headers: this.getHeaders() });
  }

  // ==================== IMAGE OPERATIONS ====================

  /**
   * Get barcode image as PNG
   * GET /api/barcodes/{id}/image
   */
  getBarcodeImage(barcodeId: number): Observable<Blob> {
    const url = `${this.getBaseUrl()}/${barcodeId}/image`;
    return this.http.get(url, { headers: this.getHeaders(), responseType: 'blob' });
  }

  /**
   * Download barcode image
   */
  downloadBarcodeImage(barcodeId: number, filename: string): void {
    this.getBarcodeImage(barcodeId).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }

  // ==================== PRINTING ====================

  /**
   * Print barcodes as PDF
   * POST /api/barcodes/print/pdf?labelSize=3x1&columns=3
   */
  printBarcodesPdf(
    barcodeIds: number[], 
    labelSize: string = '3x1', 
    columns: number = 3
  ): Observable<Blob> {
    let url = `${this.getBaseUrl()}/print/pdf`;
    const params = new HttpParams()
      .set('labelSize', labelSize)
      .set('columns', columns.toString());
    
    return this.http.post(url, barcodeIds, { 
      headers: this.getHeaders(), 
      params,
      responseType: 'blob' 
    });
  }

  /**
   * Print barcodes and open in new window
   */
  printBarcodes(barcodeIds: number[], labelSize: string = '3x1', columns: number = 3): void {
    this.printBarcodesPdf(barcodeIds, labelSize, columns).subscribe(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    });
  }

  /**
   * Bulk generate barcodes for multiple products
   * POST /api/barcodes/bulk-generate
   */
  bulkGenerateBarcodes(
    productIds: number[], 
    barcodeType: BarcodeType = 'BARCODE',
    barcodeFormat: BarcodeFormat = 'CODE_128'
  ): Observable<BarcodeResponseDTO[]> {
    const url = `${this.getBaseUrl()}/bulk-generate`;
    const body = {
      productIds,
      barcodeType,
      barcodeFormat
    };
    return this.http.post<BarcodeResponseDTO[]>(url, body, { headers: this.getHeaders() });
  }

  // ==================== FORMAT INFORMATION ====================

  /**
   * Get supported barcode formats
   * GET /api/barcodes/formats/BARCODE
   */
  getSupportedBarcodeFormats(): Observable<BarcodeFormatOption[]> {
    const url = `${this.getBaseUrl()}/formats/BARCODE`;
    return this.http.get<BarcodeFormatOption[]>(url, { headers: this.getHeaders() });
  }

  /**
   * Get supported QR code formats
   * GET /api/barcodes/formats/QRCODE
   */
  getSupportedQRCodeFormats(): Observable<BarcodeFormatOption[]> {
    const url = `${this.getBaseUrl()}/formats/QRCODE`;
    return this.http.get<BarcodeFormatOption[]>(url, { headers: this.getHeaders() });
  }

  /**
   * Get all supported formats
   */
  getAllSupportedFormats(): Observable<{ barcodes: BarcodeFormatOption[], qrcodes: BarcodeFormatOption[] }> {
    return new Observable(observer => {
      Promise.all([
        this.getSupportedBarcodeFormats().toPromise(),
        this.getSupportedQRCodeFormats().toPromise()
      ]).then(([barcodes, qrcodes]) => {
        observer.next({ barcodes: barcodes || [], qrcodes: qrcodes || [] });
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Validate barcode format
   */
  validateBarcodeFormat(value: string, format: BarcodeFormat): boolean {
    switch (format) {
      case 'EAN_13':
        return /^\d{13}$/.test(value) && this.validateEAN13CheckDigit(value);
      case 'EAN_8':
        return /^\d{8}$/.test(value) && this.validateEAN8CheckDigit(value);
      case 'UPC_A':
        return /^\d{12}$/.test(value);
      case 'UPC_E':
        return /^\d{6,8}$/.test(value);
      case 'CODE_128':
      case 'CODE_39':
      case 'CODE_93':
        return value.length > 0 && value.length <= 48;
      case 'ITF':
        return /^\d+$/.test(value) && value.length % 2 === 0;
      default:
        return value.length > 0;
    }
  }

  /**
   * Validate EAN-13 check digit
   */
  private validateEAN13CheckDigit(code: string): boolean {
    if (code.length !== 13) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(code[12], 10);
  }

  /**
   * Validate EAN-8 check digit
   */
  private validateEAN8CheckDigit(code: string): boolean {
    if (code.length !== 8) return false;
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(code[i], 10);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(code[7], 10);
  }

  /**
   * Generate EAN-13 check digit
   */
  calculateEAN13CheckDigit(code: string): number {
    if (code.length !== 12) throw new Error('Code must be 12 digits');
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    return (10 - (sum % 10)) % 10;
  }

  /**
   * Generate a preview barcode value based on product ID
   */
  generatePreviewValue(productId: number, format: BarcodeFormat): string {
    switch (format) {
      case 'EAN_13':
        const base = '200' + productId.toString().padStart(9, '0');
        return base + this.calculateEAN13CheckDigit(base);
      case 'CODE_128':
      case 'CODE_39':
        return `PRD${productId.toString().padStart(8, '0')}`;
      default:
        return `PRODUCT-${productId}`;
    }
  }

  /**
   * Convert base64 image to data URL for display
   */
  base64ToImageUrl(base64: string): string {
    if (!base64) return '';
    if (base64.startsWith('data:image')) return base64;
    return `data:image/png;base64,${base64}`;
  }
}
