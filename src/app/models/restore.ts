export interface RestoreConfig {
  enabled: boolean;
  requiresConfirmPhrase: boolean;
  confirmPhraseFormat: string;
  warning?: string;
}

export interface RestoreSettings {
  serverMasterEnabled: boolean;
  enabled: boolean;
}

export interface RestoreJob {
  id: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  createdAt?: string;
  createdBy?: string;
  startedAt?: string;
  finishedAt?: string;
  sourceBackupJobId?: number;
  sourceBackupPath?: string;
  safetyBackupJobId?: number;
  safetyBackupPath?: string;
  restoreDatabase?: boolean;
  restoreFiles?: boolean;
  fileMode?: 'OVERWRITE' | 'KEEP_OLD_FILES' | string;
  errorMessage?: string;
  rollbackAttempted?: boolean;
  rollbackSucceeded?: boolean;
  rollbackErrorMessage?: string;
}

export interface RestoreRequest {
  restoreDatabase: boolean;
  restoreFiles: boolean;
  fileMode: 'OVERWRITE' | 'KEEP_OLD_FILES';
  createSafetyBackup: boolean;
  confirmPhrase: string;
  expectedSha256?: string | null;
}
