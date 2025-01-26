import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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

  user?: KeycloakProfile;

  isEditMode = false; // Flag to track edit mode

  fields: any;

  languages: any;

  changePasswordForm: boolean;

  passwordForm: FormGroup;

  preferredLanguage: any;

  languageEdit: boolean = false;

  userRoles: Role[] = []

  submitted: boolean = false;

  initialPreferredLanguage: string;

  languageMap: { [key: string]: string } = {
    'en': 'English',
    'fr': 'Français',
    'sp': 'Español',
    // Add more languages as needed
  };

  userCredential: Credential = {};


  public profile?: KeycloakProfile;
  isLoading: boolean = true;


  constructor(private messageService: MessageService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private formBuilder: FormBuilder,
    public keycloakService: KeycloakService,
    private authService: AuthenticationService,
    ) {
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

    // Initialize passwordForm only once in ngOnInit
    this.passwordForm = this.formBuilder.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, new PasswordStrengthValidator()]],
      confirmPassword: ['', Validators.required]
    });
    console.log(this.user)
    this.getUserRoles(this.user.id);
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
        const response = await this.authService.changePassword(body.userId, this.userCredential).toPromise();
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
    const response = await this.updateUser(this.user.id, this.user);
    console.log(response)
    response ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating user', life: 3000 })
  }

  getUserRoles(userId) {
    this.authService.getUserRoles(userId)
      .subscribe({
        next: (response: any) => {
          this.userRoles = response.filter((role: any) => !role.composite);
          // return response;
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }


  async updateUser(id: any, user: any): Promise<boolean> {
    try {
      const response = await this.authService.updateUser(id, user).toPromise();
      console.log(response);
      this.getUser();
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async getUser() {
    if (this.keycloakService.isLoggedIn()) {
      try {
        const profile = await this.keycloakService.loadUserProfile();
        this.user = profile;
        this.isLoading=false;
      } catch (error) {
        console.error("Error loading user profile:", error);
        // Handle error if necessary
      }
    }
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
