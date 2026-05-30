export interface WhatsAppConfigResponse {
  enabled: boolean;
  accessTokenConfigured: boolean;
  phoneNumberId: string;
  graphApiVersion: string;
  recipientNumbers: string[];
  templateSendEnabled: boolean;
  templateName: string;
  templateLanguage: string;
  /** "positional" | "named" */
  templateBodyParamStyle: string;
  templateBodyParameterName: string;
}

export interface WhatsAppConfigUpdate {
  enabled?: boolean;
  accessToken?: string;
  phoneNumberId?: string;
  graphApiVersion?: string;
  recipientNumbers?: string[];
  templateSendEnabled?: boolean;
  templateName?: string;
  templateLanguage?: string;
  templateBodyParamStyle?: string;
  templateBodyParameterName?: string;
}
