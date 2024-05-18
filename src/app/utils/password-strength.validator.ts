import { FormGroup, ValidationErrors, Validator, Validators } from '@angular/forms';

export class PasswordStrengthValidator implements Validator {

  validate(formGroup: FormGroup): ValidationErrors | null {
  const newPasswordControl = formGroup.get('newPassword');

  // Check if newPasswordControl is null or undefined before accessing 'value'
  if (!newPasswordControl) {
    return null;
  }

  const password = newPasswordControl.value;

  if (!password || password.length < 8) {
    return { passwordStrength: 'Password must be at least 8 characters long.' };
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
    return { passwordStrength: 'Password must contain uppercase, lowercase, numbers, and special characters.' };
  }

  return null;
}
}