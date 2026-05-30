import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { User } from 'src/app/models/user';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { PasswordStrengthValidator } from 'src/app/utils/password-strength.validator';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakProfile } from 'keycloak-js';
import { KeycloakService } from 'keycloak-angular';
import { Role } from 'src/app/models/role';
import { Credential } from 'src/app/models/credential';

@Component({
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  providers: [MessageService]
})
export class ProfileComponent implements OnInit {
  readonly systemRoleNames = ['ADMIN', 'CASHIER', 'VENDOR', 'WAREHOUSEMAN', 'AUDITOR', 'ACCOUNTANT'];

  user?: KeycloakProfile;

  isEditMode = false; // Flag to track edit mode

  fields: any;

  languages: any;

  changePasswordForm: boolean;

  passwordForm: FormGroup;

  preferredLanguage: any;

  languageEdit: boolean = false;

  userRoles: any;

  submitted: boolean = false;

  initialPreferredLanguage: string;

  languageMap: { [key: string]: string } = {
    'en': 'English',
    'fr': 'Français',
    'es': 'Español',
    'ar': 'الْعَرَبِيَّةُ',
    // Add more languages as needed
  };

  userCredential: Credential = {};


  public profile?: KeycloakProfile;
  isLoading: boolean = true;
  
  posPin: string = '';
  isEditingPosPin: boolean = false;

  isAdmin: boolean = false;


  constructor(private messageService: MessageService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private formBuilder: FormBuilder,
    public keycloakService: KeycloakService,
    private authService: AuthenticationService,
    private router: Router
    ) {
    // Ensure template [formGroup] always receives a FormGroup instance.
    this.initForm();
  }

  async ngOnInit() {
    this.isLoading=true;
    this.translationService.currentLanguage$.subscribe(lang => {
      console.log(lang);
      this.translate.use(lang); // Use the translate service to update language
    });
    this.preferredLanguage = this.translationService.getPreferredLanguage();
    this.initialPreferredLanguage = this.preferredLanguage;


    await this.getUser();

    this.fields = [
      { label: 'user_first_name', property: 'firstName', isEditing: false },
      { label: 'user_last_name', property: 'lastName', isEditing: false },
      { label: 'user_email', property: 'email', isEditing: false },
    ];

    this.languages = this.translationService.supportedLanguages;

    this.changePasswordForm = false;

    console.log(this.user)
    this.initForm();

  }

  initForm() {
    this.passwordForm = this.formBuilder.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', Validators.required],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  async onSubmitPassword() {
    this.submitted = true;
    this.userCredential = {}
    if (this.passwordForm.valid) {
      // Submit password change
      let values = this.passwordForm.value;
      let body = {
        userId: this.user?.id,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      };
      this.userCredential.temporary = false;
      this.userCredential.type = "password";
      this.userCredential.value = body.newPassword;

      try {
        const response = await this.authService.changeMyPassword({
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
          confirmPassword: body.confirmPassword
        }).toPromise();
        console.log(response);
        this.getUser();
        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Password Updated', life: 3000 });
      } catch (error) {
        console.log(error);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating password', life: 3000 })
      }
      this.changePasswordForm = false;
      this.initForm();

    }
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword')!.value;
    const confirmPassword = form.get('confirmPassword')!.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  toggleEditMode(field: any) {
    if (field.isEditing) {
      this.saveUser();
    }

    field.isEditing = !field.isEditing; // Toggle edit mode for the clicked field

    this.getUser();
  }

  async saveUser() {
    const response = await this.updateUser(this.user);
    console.log(response)
    response ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating user', life: 3000 })
  }

  async updateUser(user: any): Promise<boolean> {
    try {
      const payload = {
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        email: user?.email ?? null,
        attributes: user?.attributes ?? {}
      };
      const response = await this.authService.updateMyProfile(payload).toPromise();
      console.log(response);
      this.getUser();
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  private async setUserRoles() {
    const rawRoles = await this.keycloakService.getUserRoles();
    const normalized = Array.isArray(rawRoles) ? rawRoles : [];
    const filtered = normalized
      .filter((roleName: string) => this.systemRoleNames.includes((roleName || '').toUpperCase()));
    this.userRoles = filtered.map((roleName: string) => ({ name: roleName } as Role));
    this.isAdmin = filtered.includes('ADMIN');
  }

  async getUser() {
    if (this.keycloakService.isLoggedIn()) {
      try {
        const profile: any = await this.authService.getMyProfile().toPromise();
        this.user = profile;
        await this.setUserRoles();
        // Load POS PIN from attributes (Keycloak stores attributes as arrays; backend may return scalar)
        const rawPosPin = (profile?.attributes as any)?.posPin;
        if (Array.isArray(rawPosPin)) {
          this.posPin = rawPosPin.length > 0 && rawPosPin[0] != null ? String(rawPosPin[0]) : '';
        } else if (rawPosPin == null) {
          this.posPin = '';
        } else {
          this.posPin = String(rawPosPin);
        }
        this.isLoading=false;
      } catch (error) {
        console.error("Error loading user profile:", error);
        this.posPin = '';
      }
    }
  }

  togglePosPinEdit() {
    if (this.isEditingPosPin) {
      this.savePosPin();
    } else {
      this.isEditingPosPin = true;
    }
  }

  async savePosPin() {
    if (!this.user?.id) {
      return;
    }

    try {
      // Keycloak attributes need to be sent as arrays
      const userUpdate = {
        ...this.user,
        attributes: {
          ...(this.user.attributes as any || {}),
          posPin: this.posPin ? [this.posPin] : []
        }
      };

      const success = await this.updateUser(userUpdate);
      if (success) {
        this.isEditingPosPin = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('user_updated'),
          life: 3000
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_updating_user'),
          life: 3000
        });
      }
    } catch (error) {
      console.error('Error saving POS PIN:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 3000
      });
    }
  }

  cancelPosPinEdit() {
    // Reload PIN from user profile
    this.getUser();
    this.isEditingPosPin = false;
  }

  onPosPinInput(event: any) {
    // Only allow numeric characters
    const value = event.target.value;
    this.posPin = value.replace(/[^0-9]/g, '');
  }

  navigateToNotificationPreferences(): void {
    this.router.navigate(['/profile/notifications']);
  }

  openChangePassword() {
    this.initForm()
    this.changePasswordForm = true;
  }

  // onSubmit() {
  //   console.log('Form validity:', this.passwordForm.valid);
  //   if (this.passwordForm.valid) {
  //     let values = this.passwordForm.value;
  //     let user = this.user; // Assuming this.user is properly populated
  //     console.log(user)
  //     let body = {
  //       userName: user.username,
  //       currentPassword: values.currentPassword,
  //       newPassword: values.newPassword,
  //       confirmPassword: values.confirmPassword,
  //     };
  //     //this.updatePassword(body) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Password changed with success', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating passsword', life: 3000 });
  //     this.cdr.markForCheck();
  //   }
  // }

  updatePassword(values: any) {
    console.log(values)
    let isChanged = false;

  }

  // mustMatch(controlName: string, matchingControlName: string) {
  //   return (formGroup: FormGroup) => {
  //     const control = formGroup.controls[controlName];
  //     const matchingControl = formGroup.controls[matchingControlName];

  //     if (control.value !== matchingControl.value) {
  //       matchingControl.setErrors({ mustMatch: true });
  //     } else {
  //       matchingControl.setErrors(null);
  //     }
  //   };
  // }

  changeLanguage() {
    if (this.languageEdit) {
      if (this.preferredLanguage !== this.initialPreferredLanguage) {
        this.translationService.setLanguage(this.preferredLanguage);
        window.location.reload();
      }
    } else {
      this.languageEdit = !this.languageEdit;
    }
  }

  getDisplayName(): string {
    const firstName = this.user?.firstName?.trim() || '';
    const lastName = this.user?.lastName?.trim() || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || this.user?.username || this.user?.email || this.translate.instant('profile');
  }

  getRoleLabel(roleName: string): string {
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

  getSeverity(status: any) {
    switch (status) {
      case false:
        return 'danger';

      case true:
        return 'success';

      case 'new':
        return 'info';

      case 'negotiation':
        return 'warning';

      case 'renewal':
        return null;

      default:
        return '';
    }
  }

}
