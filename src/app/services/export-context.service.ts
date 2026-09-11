import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { Organization } from '../models/organization';
import { ExportDocumentHeader } from '../utils/reporting.service';
import { OrganizationService } from './organization.service';

/**
 * Runs an export with translations switched to the organization's locale, and hands it a ready
 * document header.
 *
 * <p>An exported file belongs to the organization, not to whoever happened to click Export, so its
 * title, column headings and header block are produced in the organization's language rather than
 * the operator's. Every export page was doing this by hand — fetch the organization, remember the
 * current language, switch, translate, switch back — which is why six pages that never got round
 * to it exported with no header at all.</p>
 *
 * <p>The locale is restored in a {@code finally}. The hand-written copies restore it on the happy
 * path only, so an export that threw halfway left the whole console in the organization's language
 * until the next reload.</p>
 */
@Injectable({ providedIn: 'root' })
export class ExportContextService {

  constructor(
    private organizationService: OrganizationService,
    private translate: TranslateService,
  ) {}

  /**
   * @param titleKey translation key naming the report, e.g. 'users_menu_title'
   * @param run      does the exporting; receives the header to pass to ReportingService. Build the
   *                 rows inside it — translations are only in the organization's locale here.
   */
  async withOrganizationLocale<T>(
    titleKey: string,
    run: (header: ExportDocumentHeader) => T | Promise<T>,
  ): Promise<T> {
    const previousLang = this.translate.currentLang;
    const organization = await this.loadOrganization();
    const locale = organization?.defaultLocale || previousLang || 'en';

    try {
      if (locale !== previousLang) {
        this.translate.use(locale);
        await firstValueFrom(this.translate.getTranslation(locale));
      }
      return await run({
        title: this.translate.instant(titleKey),
        organizationName: organization?.organizationName,
        generatedLabel: this.translate.instant('export_generated_on'),
        generatedAt: new Date().toLocaleString(locale),
      });
    } finally {
      if (previousLang && previousLang !== locale) {
        this.translate.use(previousLang);
      }
    }
  }

  /**
   * A failure here must not cost the user their export — the header simply loses the organization
   * name and the locale falls back to the one on screen.
   */
  private async loadOrganization(): Promise<Organization | null> {
    try {
      await this.organizationService.loadToken();
      return (await firstValueFrom(this.organizationService.getOrganization())) as Organization;
    } catch {
      return null;
    }
  }
}
