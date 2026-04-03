import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';

/** Default tab: admins land on sales summary; accountants/auditors on credit reports. */
@Component({
  selector: 'app-reports-default-redirect',
  template: ''
})
export class ReportsDefaultRedirectComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private keycloak: KeycloakService
  ) {}

  async ngOnInit(): Promise<void> {
    const roles = await this.keycloak.getUserRoles();
    if (roles.includes('ADMIN')) {
      await this.router.navigate(['sales'], { relativeTo: this.route.parent, replaceUrl: true });
    } else if (roles.includes('ACCOUNTANT') || roles.includes('AUDITOR')) {
      await this.router.navigate(['credit'], { relativeTo: this.route.parent, replaceUrl: true });
    } else {
      await this.router.navigate(['/']);
    }
  }
}
