export interface AuditLog {
  id: number;
  timestamp: string;
  actionType: string;
  userId: string;
  username: string;
  userEmail: string;
  userRole: string;
  actionDescription: string;
  resourceType: string;
  resourceId: number | null;
  resourceName: string | null;
  requestPath: string;
  httpMethod: string;
  clientIp: string;
  userAgent: string;
  success: boolean;
  errorMessage: string | null;
  responseSummary: string | null;
  shopId: string | null;
  warehouseId: string | null;
}

export interface AuditLogFilters {
  userId?: string;
  actionType?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

export interface AuditLogResponse {
  content: AuditLog[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
