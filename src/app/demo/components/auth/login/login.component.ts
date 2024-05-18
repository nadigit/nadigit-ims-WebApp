import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styles: [`
        :host ::ng-deep .pi-eye,
        :host ::ng-deep .pi-eye-slash {
            transform:scale(1.6);
            margin-right: 1rem;
            color: var(--primary-color) !important;
        }
    `]
})
export class LoginComponent implements OnInit {

  valCheck: string[] = ['remember'];

  password!: string;

  isLogin: boolean;

  loginError: string = '';

  constructor(public layoutService: LayoutService, 
    private authService: AuthenticationService, 
    private translate: TranslateService,
    private translateService: TranslationService,
    private router: Router) { }

  ngOnInit(): void {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.isLogin = true;
    this.authService.logout();
  }

  login(data: any) {
    this.authService.login(data)
      .subscribe({
        next: (response: any) => {
          console.log("in")
          let jwt = response.body.accessToken;
          this.authService.saveToken(jwt);
          this.router.navigateByUrl("/");
        },
        error: (err: any) => {
          if (err.status === 500) {
            this.loginError = 'Internal server error. Please try again later.';
            
          } else {
            this.loginError = 'Invalid username or password';
          }
          console.error(this.loginError)
        } 
      });
  }

  onLogin() {
    this.isLogin = true;
  }

  onForgotPassword() {
    this.isLogin = false;
  }

  forgotPassword(values) {
    console.log("This is your email :"+ values.email);
    this.authService.forgotPassword(values)
      .subscribe({
        next: (response: any) => {
          console.log("email sent with success")
        },
        error: (err: any) => console.log('not getting response')
      })
  }

}
