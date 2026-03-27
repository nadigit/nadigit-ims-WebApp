export interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpFromAddress: string;
  smtpFromName: string;
  smtpAuth: boolean;
  smtpStartTls: boolean;
  smtpSsl: boolean;
}
