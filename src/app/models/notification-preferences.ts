export interface NotificationPreferences {
  notifPreferenceId?: number;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  workingHoursOnly: boolean;
  priorityOnly: boolean;
  mutedTypes: string[];
  createdDate?: string;
  lastModifiedDate?: string;
}
