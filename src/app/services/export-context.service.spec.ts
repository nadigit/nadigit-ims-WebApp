import { of, throwError } from 'rxjs';
import { ExportContextService } from './export-context.service';

/**
 * An export runs in the organization's language, not the operator's — and must put the language
 * back afterwards.
 *
 * The nineteen hand-written copies of this dance restore the locale on the happy path only, so an
 * export that threw halfway left the whole console in the organization's language until reload.
 * That is the behaviour these pin.
 */
describe('ExportContextService', () => {

  const organization = { organizationName: 'Fomadis SARL', defaultLocale: 'fr' };

  let used: string[];
  let translate: any;
  let organizationService: any;

  beforeEach(() => {
    used = [];
    translate = {
      currentLang: 'en',
      use: (lang: string) => { used.push(lang); translate.currentLang = lang; },
      getTranslation: () => of({}),
      instant: (key: string) => `${key}@${translate.currentLang}`,
    };
    organizationService = {
      loadToken: () => Promise.resolve(),
      getOrganization: () => of(organization),
    };
  });

  const service = () => new ExportContextService(organizationService, translate);

  it('runs the export in the organization locale and restores the previous one', async () => {
    let localeDuringRun: string | undefined;

    await service().withOrganizationLocale('report_title', () => {
      localeDuringRun = translate.currentLang;
    });

    expect(localeDuringRun).toBe('fr');
    expect(translate.currentLang).toBe('en');
    expect(used).toEqual(['fr', 'en']);
  });

  it('restores the locale even when the export throws', async () => {
    await expectAsync(
      service().withOrganizationLocale('report_title', () => {
        throw new Error('export blew up');
      })
    ).toBeRejected();

    // The console must not be left in French because a PDF failed.
    expect(translate.currentLang).toBe('en');
  });

  it('builds a header translated in the organization locale', async () => {
    let header: any;
    await service().withOrganizationLocale('report_title', (h) => { header = h; });

    expect(header.title).toBe('report_title@fr');
    expect(header.organizationName).toBe('Fomadis SARL');
    expect(header.generatedLabel).toBe('export_generated_on@fr');
    expect(header.generatedAt).toBeTruthy();
  });

  it('still exports when the organization cannot be loaded', async () => {
    organizationService.getOrganization = () => throwError(() => new Error('offline'));
    let ran = false;

    await service().withOrganizationLocale('report_title', (h) => {
      ran = true;
      expect(h.organizationName).toBeUndefined();
    });

    // Losing the organization name is a worse header, not a failed export.
    expect(ran).toBeTrue();
    expect(translate.currentLang).toBe('en');
  });

  it('does not switch at all when the locales already match', async () => {
    translate.currentLang = 'fr';
    await service().withOrganizationLocale('report_title', () => undefined);

    expect(used).toEqual([]);
  });
});
