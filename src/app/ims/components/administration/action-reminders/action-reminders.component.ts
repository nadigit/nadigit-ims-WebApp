import { Component, OnInit } from '@angular/core';
import { ActionReminderItem } from 'src/app/models/action-reminder';
import { ActionReminderService } from 'src/app/services/action-reminder.service';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-action-reminders',
  templateUrl: './action-reminders.component.html',
  styleUrls: ['./action-reminders.component.css']
})
export class ActionRemindersComponent implements OnInit {
  items: ActionReminderItem[] = [];
  loading = false;
  tier = 'STARTER';

  constructor(
    private actionReminderService: ActionReminderService,
    private router: Router,
    private messageService: MessageService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadReminders();
  }

  loadReminders(): void {
    this.loading = true;
    this.actionReminderService.getAdminActionReminders().subscribe({
      next: (response) => {
        this.items = response?.items || [];
        this.tier = response?.tier || 'STARTER';
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('failed_to_load_action_reminders')
        });
      }
    });
  }

  goToAction(item: ActionReminderItem): void {
    const target = this.resolveActionReminderUrl(item?.actionUrl);
    if (!target) {
      return;
    }
    this.router.navigateByUrl(target);
  }

  /**
   * Maps legacy `/pages/...` URLs from the API to real AppLayout routes (`/finance/...`, `/inventory/...`, etc.).
   * Stripping `/pages` alone produced paths like `/expenses` which do not exist (404).
   */
  private resolveActionReminderUrl(raw: string | undefined | null): string | null {
    if (!raw?.trim()) {
      return null;
    }
    let u = raw.trim();
    const qIndex = u.indexOf('?');
    const pathOnly = qIndex >= 0 ? u.slice(0, qIndex) : u;
    const query = qIndex >= 0 ? u.slice(qIndex) : '';
    const normalizedPath = pathOnly.replace(/\/+$/, '') || '/';

    const legacyMap: Record<string, string> = {
      '/pages/expenses': '/finance/expenses',
      '/pages/inventory-write-offs': '/inventory/write-offs',
      '/pages/order-returns': '/sales/returns',
      '/pages/purchase-returns': '/purchases/purchase-returns',
      '/pages/refunds': '/finance/refunds',
      '/pages/warehouse-transfers': '/inventory/warehouse-transfers',
    };

    for (const [from, to] of Object.entries(legacyMap)) {
      if (normalizedPath === from || normalizedPath.startsWith(from + '/')) {
        const rest = normalizedPath.length > from.length ? normalizedPath.slice(from.length) : '';
        return to + rest + query;
      }
    }

    if (
      normalizedPath.startsWith('/finance/') ||
      normalizedPath.startsWith('/inventory/') ||
      normalizedPath.startsWith('/sales/') ||
      normalizedPath.startsWith('/purchases/') ||
      normalizedPath.startsWith('/administration/')
    ) {
      return normalizedPath + query;
    }

    if (normalizedPath.startsWith('/pages/')) {
      return null;
    }

    return u;
  }

  getSeverity(level: string): 'danger' | 'warning' | 'info' | 'success' {
    const normalized = (level || '').toLowerCase();
    if (normalized === 'high') {
      return 'danger';
    }
    if (normalized === 'medium') {
      return 'warning';
    }
    return 'info';
  }
}
