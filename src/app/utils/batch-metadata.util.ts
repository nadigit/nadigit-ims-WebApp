import { BatchMetadata } from '../models/warehouseTransfer';

export class BatchMetadataUtil {
  /**
   * Parse batch metadata JSON string into array of BatchMetadata objects
   */
  static parseBatchMetadata(batchMetadata?: string): BatchMetadata[] {
    if (!batchMetadata) {
      return [];
    }
    
    try {
      return JSON.parse(batchMetadata) as BatchMetadata[];
    } catch (error) {
      console.error('Error parsing batch metadata:', error);
      return [];
    }
  }

  /**
   * Format batch metadata for display
   */
  static formatBatchMetadata(batches: BatchMetadata[]): string {
    if (batches.length === 0) {
      return 'No batch information';
    }
    
    return batches.map(batch => {
      const parts = [];
      if (batch.batchNumber) parts.push(`Batch: ${batch.batchNumber}`);
      parts.push(`Qty: ${batch.quantity}`);
      if (batch.expirationDate) parts.push(`Exp: ${new Date(batch.expirationDate).toLocaleDateString()}`);
      if (batch.buyingPrice) parts.push(`Price: $${batch.buyingPrice.toFixed(2)}`);
      return parts.join(' | ');
    }).join('; ');
  }

  /**
   * Get total quantity from batch metadata
   */
  static getTotalQuantity(batches: BatchMetadata[]): number {
    return batches.reduce((sum, batch) => sum + batch.quantity, 0);
  }

  /**
   * Check if batch metadata exists and is valid
   */
  static hasBatchMetadata(batchMetadata?: string): boolean {
    return !!batchMetadata && batchMetadata.trim() !== '';
  }
}

