export interface KeycloakEvent {
  time?: number;
  type?: string;
  realmId?: string;
  clientId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  error?: string;
  details?: { [key: string]: string };
}

