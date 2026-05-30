export type BusinessActivityProfileValue =
  | 'GENERAL_RETAIL'
  | 'FASHION'
  | 'PHARMACY'
  | 'RESTAURANT'
  | 'WHOLESALE';

export interface BusinessProfileCapabilities {
  emphasizeBatchAndExpiry: boolean;
  emphasizeProductVariants: boolean;
  emphasizeB2bWorkflow: boolean;
  emphasizePosRetail: boolean;
  suggestRecipesOrComponents: boolean;
}

export interface ActivityProfileContext {
  businessActivityProfile: BusinessActivityProfileValue | null;
  capabilities: BusinessProfileCapabilities;
  profileSelectionRequired: boolean;
  /** True when first-time profile selection updated app_configuration presets (sales/POS/process mode). */
  initialConfigurationPresetsApplied?: boolean;
  /** Organization default locale (e.g. en, fr) from GET/PATCH activity profile context. */
  defaultLocale?: string | null;
}
