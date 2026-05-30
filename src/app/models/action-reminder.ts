export interface ActionReminderItem {
  key: string;
  title: string;
  count: number;
  severity: string;
  actionUrl: string;
  requiredFeature?: string | null;
}

export interface ActionRemindersResponse {
  tier: string;
  items: ActionReminderItem[];
}
