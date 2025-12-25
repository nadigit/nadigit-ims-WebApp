/**
 * Barcode Management Models
 * Interfaces for the barcode management API
 */

export type BarcodeType = 'BARCODE' | 'QRCODE';

export type BarcodeFormat = 
  // 1D Barcode Formats
  | 'CODE_128' 
  | 'CODE_39' 
  | 'CODE_93'
  | 'EAN_13' 
  | 'EAN_8' 
  | 'UPC_A' 
  | 'UPC_E'
  | 'ITF'
  | 'CODABAR'
  // 2D Barcode Formats
  | 'QR_CODE' 
  | 'DATA_MATRIX'
  | 'AZTEC'
  | 'PDF_417';

export interface BarcodeRequestDTO {
  productId: number;
  barcodeType: BarcodeType;
  barcodeFormat: BarcodeFormat;
  customValue?: string;
  isPrimary?: boolean;
  label?: string;
}

export interface BarcodeResponseDTO {
  barcodeId: number;
  barcodeValue: string;
  barcodeType: BarcodeType;
  barcodeFormat: BarcodeFormat;
  productId: number;
  productName: string;
  isPrimary: boolean;
  imageBase64: string; // PNG ready to display
  label?: string;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BarcodeScanResultDTO {
  found: boolean;
  barcodeValue?: string;
  barcodeType?: BarcodeType;
  barcodeFormat?: BarcodeFormat;
  productId?: number;
  productName?: string;
  productReference?: string;
  sellingPrice?: number;
  buyingPrice?: number;
  quantityAvailable?: number;
  inventoryStatus?: string;
  categoryName?: string;
  warehouseName?: string;
  supplierName?: string;
  productImage?: string;
  measureUnit?: string;
}

export interface BarcodePrintRequest {
  barcodeIds: number[];
  labelSize?: '2x1' | '3x1' | '4x2' | 'CUSTOM';
  columns?: number;
  includePrice?: boolean;
  includeName?: boolean;
  includeReference?: boolean;
}

export interface BarcodeFormatOption {
  value: BarcodeFormat;
  label: string;
  type: BarcodeType;
  description?: string;
}

// Helper function to get available barcode formats
export function getBarcodeFormats(): BarcodeFormatOption[] {
  return [
    { value: 'CODE_128', label: 'Code 128', type: 'BARCODE', description: 'High-density alphanumeric' },
    { value: 'CODE_39', label: 'Code 39', type: 'BARCODE', description: 'Alphanumeric with special chars' },
    { value: 'CODE_93', label: 'Code 93', type: 'BARCODE', description: 'Compact Code 39 variant' },
    { value: 'EAN_13', label: 'EAN-13', type: 'BARCODE', description: '13-digit retail barcode' },
    { value: 'EAN_8', label: 'EAN-8', type: 'BARCODE', description: '8-digit compact retail barcode' },
    { value: 'UPC_A', label: 'UPC-A', type: 'BARCODE', description: '12-digit US retail barcode' },
    { value: 'UPC_E', label: 'UPC-E', type: 'BARCODE', description: '6-digit compact UPC' },
    { value: 'ITF', label: 'ITF', type: 'BARCODE', description: 'Interleaved 2 of 5' },
    { value: 'CODABAR', label: 'Codabar', type: 'BARCODE', description: 'Numeric with special chars' },
  ];
}

export function getQRCodeFormats(): BarcodeFormatOption[] {
  return [
    { value: 'QR_CODE', label: 'QR Code', type: 'QRCODE', description: 'Standard QR code' },
    { value: 'DATA_MATRIX', label: 'Data Matrix', type: 'QRCODE', description: 'High-density 2D code' },
    { value: 'AZTEC', label: 'Aztec', type: 'QRCODE', description: 'Compact 2D code' },
    { value: 'PDF_417', label: 'PDF 417', type: 'QRCODE', description: 'Stacked linear barcode' },
  ];
}

export function getAllBarcodeFormats(): BarcodeFormatOption[] {
  return [...getBarcodeFormats(), ...getQRCodeFormats()];
}

export function getFormatsByType(type: BarcodeType): BarcodeFormatOption[] {
  return type === 'BARCODE' ? getBarcodeFormats() : getQRCodeFormats();
}

// Label size options
export interface LabelSizeOption {
  value: string;
  label: string;
  width: number;
  height: number;
}

export function getLabelSizeOptions(): LabelSizeOption[] {
  return [
    { value: '2x1', label: '2" x 1" (Small)', width: 2, height: 1 },
    { value: '3x1', label: '3" x 1" (Standard)', width: 3, height: 1 },
    { value: '4x2', label: '4" x 2" (Large)', width: 4, height: 2 },
    { value: 'CUSTOM', label: 'Custom Size', width: 0, height: 0 },
  ];
}

