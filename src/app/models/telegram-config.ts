/** GET /api/telegram/config */
export interface TelegramConfigResponse {
  enabled: boolean;
  botTokenConfigured: boolean;
  chatIds: string[];
}

/** POST /api/telegram/config body (omit botToken to leave unchanged) */
export interface TelegramConfigUpdate {
  enabled?: boolean;
  botToken?: string;
  chatIds?: string[];
}
