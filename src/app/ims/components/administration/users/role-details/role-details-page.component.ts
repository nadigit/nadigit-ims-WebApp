import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { Role } from 'src/app/models/role';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
  selector: 'app-role-details-page',
  templateUrl: './role-details-page.component.html',
  styleUrls: ['./role-details-page.component.css', '../../administration.component.css'],
  providers: [MessageService]
})
export class RoleDetailsPageComponent implements OnInit {
  roleName!: string;
  role: Role | null = null;
  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private authService: AuthenticationService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translationService: TranslationService
  ) {}

  async ngOnInit() {
    this.isLoading = true;

    this.translationService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.roleName = params['name'];
      if (!this.roleName) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_role_name'),
          life: 3000
        });
        this.router.navigate(['/administration/users']);
        return;
      }
      await this.loadRole();
    });
  }

  async loadRole(): Promise<void> {
    try {
      await this.authService.loadToken();
      const roles = await firstValueFrom(this.authService.getRoles());
      if (Array.isArray(roles)) {
        this.role = roles.find((role: Role) => role.name === this.roleName) || null;
      }
      if (!this.role) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('role_not_found'),
          life: 3000
        });
        this.router.navigate(['/administration/users']);
      }
    } catch (error: any) {
      console.error('Error loading role:', error);
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_loading_role');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 3000
      });
      this.router.navigate(['/administration/users']);
    } finally {
      this.isLoading = false;
    }
  }

  goBack(): void {
    this.location.back();
  }

  getRoleLabel(roleName: string | undefined): string {
    if (!roleName) return '';
    const key = `user_role_${roleName.toLowerCase()}`;
    const translated = this.translate.instant(key);
    if (translated && translated !== key) {
      return translated;
    }
    return roleName
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  getRoleTypeLabel(): string {
    return this.role?.composite
      ? this.translate.instant('composite_role')
      : this.translate.instant('simple_role');
  }

  getRoleScopeLabel(): string {
    return this.role?.clientRole
      ? this.translate.instant('client_role')
      : this.translate.instant('realm_role');
  }
}
