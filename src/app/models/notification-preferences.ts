export interface NotificationPreferences {
  notifPreferenceId?: number;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  workingHoursOnly: boolean;
  priorityOnly: boolean;
  mutedTypes: string[];
  /** BCP 47 language tag for email / Telegram / WhatsApp alerts: en, fr, ar, es */
  preferredLocale?: string;
  createdDate?: string;
  lastModifiedDate?: string;
}
