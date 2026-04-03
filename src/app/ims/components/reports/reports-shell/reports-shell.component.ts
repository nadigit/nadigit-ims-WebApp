import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-reports-shell',
  templateUrl: './reports-shell.component.html',
  styleUrls: ['./reports-shell.component.css']
})
export class ReportsShellComponent implements OnInit {
  showAnalyticsReports = false;
  showCreditReportsLink = false;

  constructor(
    private translate: TranslateService,
    private translationService: TranslationService,
    private keycloak: KeycloakService
  ) {}

  async ngOnInit(): Promise<void> {
    this.translationService.currentLanguage$.subscribe(() =>
      this.translate.use(this.translationService.getPreferredLanguage())
    );
    const roles = await this.keycloak.getUserRoles();
    this.showAnalyticsReports = roles.includes('ADMIN');
    this.showCreditReportsLink =
      roles.includes('ADMIN') || roles.includes('ACCOUNTANT') || roles.includes('AUDITOR');
  }
}
