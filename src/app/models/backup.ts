export interface BackupJob {
  id: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  backupType: 'FULL' | string;
  createdAt?: string;
  createdBy?: string;
  startedAt?: string;
  finishedAt?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  errorMessage?: string;
}

export interface BackupConfig {
  enabled: boolean;
  baseDir: string;
  includePaths: string[];
  retentionDays: number;
  cron: string;
}
