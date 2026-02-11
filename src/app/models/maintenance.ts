export interface MaintenanceStatus {
  enabled: boolean;
  message?: string;
  enabledAt?: string | null;
  enabledBy?: string | null;
}
