/** Storefront platforms the IMS can integrate with (IMS itself stays platform-agnostic). */
export type EcommercePlatform = 'BAGISTO' | 'SHOPIFY' | 'WOOCOMMERCE' | 'CUSTOM';

/** Outcome of a sync event, mirrors the backend {@code EcommerceSyncStatus}. */
export type EcommerceSyncStatus = 'SUCCESS' | 'WARNING' | 'FAILED' | 'CONFLICT';

/** Admin view of a storefront integration (secret never returned — only the configured flag). */
export interface EcommerceIntegration {
  integrationId?: number;
  platform: EcommercePlatform;
  name: string;
  storefrontUrl?: string | null;
  warehouseId?: number | null;
  shopId?: number | null;
  webhookPath?: string | null;
  keycloakClientId?: string | null;
  hmacSecretConfigured?: boolean;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Create/update payload. {@code hmacSecret} is write-only: null = unchanged, '' = clear, else replace. */
export interface EcommerceIntegrationRequest {
  platform: EcommercePlatform;
  name: string;
  storefrontUrl?: string | null;
  warehouseId?: number | null;
  shopId?: number | null;
  webhookPath?: string | null;
  keycloakClientId?: string | null;
  hmacSecret?: string | null;
  enabled: boolean;
}

/** Ready-to-import connector bundle returned by provision (snake_case matches the connector import). */
export interface EcommerceConnectorBundle {
  backend_url: string;
  keycloak_token_url: string;
  keycloak_client_id: string;
  keycloak_client_secret: string;
  webhook_secret: string;
}

/** Compact projection of the latest sync-log row in one direction. */
export interface EcommerceLastSync {
  at?: string;
  status?: EcommerceSyncStatus;
  operation?: string;
  reference?: string;
  detail?: string;
}

/** At-a-glance health for the console (derived from the sync log; no external calls). */
export interface EcommerceIntegrationHealth {
  integrationId: number;
  platform: EcommercePlatform;
  name: string;
  enabled: boolean;
  provisioned: boolean;
  storefrontUrl?: string;
  warehouseId?: number;
  shopId?: number;
  lastInbound?: EcommerceLastSync | null;
  lastOutbound?: EcommerceLastSync | null;
  /** True while last-sync figures are global rather than scoped to this integration. */
  syncMetricsGlobal: boolean;
}

/** Result of the live "test connection" probe. */
export interface EcommerceConnectionTest {
  reachable: boolean;
  targetUrl?: string;
  httpStatus?: number;
  durationMs: number;
  detail?: string;
}
