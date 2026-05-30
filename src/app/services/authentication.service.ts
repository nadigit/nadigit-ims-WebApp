import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { KeycloakService } from 'keycloak-angular';
import { Router } from '@angular/router';
import { KeycloakProfile } from 'keycloak-js';
import { environment } from 'src/environments/environment';
import { ProcessModeService } from './process-mode.service';

@Injectable({providedIn: 'root'})
export class AuthenticationService {
  readonly systemRoleNames = ['ADMIN', 'CASHIER', 'VENDOR', 'WAREHOUSEMAN', 'AUDITOR', 'ACCOUNTANT'];

  // IMS backend proxy for Keycloak Admin REST.
  keycloakAdminSchema: string = "/api/admin/keycloak";
  profileSchema: string = "/api/profile/me";
  // Legacy direct Keycloak endpoints still used by register/forgot-password/profile.
  kcRealm: string = "/admin/realms/" + ((window as any).__env.kcRealm || "Nadigit_ims");
  jwt?:any;
  username?:string= '';
  roles?:Array<any>=[];
  auth?:boolean= false;
  private userProfile: KeycloakProfile | undefined;

  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';
  kcHost: string = (window as any).__env.kcHost || 'localhost';
  kcPort: string = (window as any).__env.kcPort || '8080';

  constructor(private http:HttpClient, 
              public keycloakService: KeycloakService,
              private router: Router,
              private processModeService: ProcessModeService) { }

  registerUser(user: any){
    return this.http.post(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/register",user,{observe:'response'})
  }

  async loadToken() {
    this.jwt = await this.keycloakService.getToken();
  }

  getUsers(){
    if (!this.jwt) {
      this.loadToken();
    }
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/users",{headers:headers});
  }

  getUser(userId: string){
    if (!this.jwt) {
      this.loadToken();
    }
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/users/"+userId,{headers:headers});
  }

  // async getUsers() {
  //   if (!this.jwt) {
  //     await this.loadToken();
  //   }
  //   const headers = new HttpHeaders({ 'authorization': `Bearer ${this.jwt}` });
    
  //   return this.http.get(`${this.host1}/users/`, { headers: headers }).pipe(
  //     catchError((error) => {
  //       console.error('Error fetching users:', error);
  //       return throwError(error);
  //     })
  //   );
  // }

  getRoles(){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/roles",{headers:headers})
      .pipe(map((roles: any) => this.filterSystemRoles(roles)));
  }

  getUserRoles(userId){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/users/"+userId+"/role-mappings/realm",{headers:headers})
      .pipe(map((roles: any) => this.filterSystemRoles(roles)));
  }

  private filterSystemRoles(roles: any): any[] {
    if (!Array.isArray(roles)) {
      return [];
    }
    return roles.filter((role: any) => this.systemRoleNames.includes((role?.name || role || '').toUpperCase()));
  }

  saveUser(user: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/users", user, {headers:headers})
  }

  saveUserRolesMapping(userId, role){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/users/"+userId+"/role-mappings/realm", role, {headers:headers});
  }

  deleteUserRolesMapping(userId: any, role: any): Observable<any> {
    if (this.jwt == null) {
      this.loadToken();
    }
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +'/users/'+userId+'/role-mappings/realm';
    const payload = Array.isArray(role) ? role : [role];
    return this.http.delete(url, { headers: headers, body: payload });
  }

  saveRole(role: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/roles", role, {headers:headers})
  }

  deleteUser(id: string){ 
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/users/"+id,{headers:headers});
  }

  deleteRole(id: string){ 
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/roles/"+id,{headers:headers});
  }

  updateUser(id: any, user: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/users/"+id , user, {headers:headers});
  }

  updateRole(id: any, role: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema +"/roles/"+id , role, {headers:headers});
  }

  changePassword(id: any, credentials: any) {
    if(this.jwt==null) this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.keycloakAdminSchema  + "/users/"+id+"/reset-password", credentials, { headers: headers });
  }

  updateMyProfile(payload: any) {
    if (this.jwt == null) this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.profileSchema, payload, { headers: headers });
  }

  changeMyPassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    if (this.jwt == null) this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.profileSchema + '/password', payload, { headers: headers });
  }

  getMyProfile() {
    if (this.jwt == null) this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.profileSchema, { headers: headers });
  }

  forgotPassword(data: any): Observable<any> {
    console.log('request forgot pwd sent');
    return this.http.post(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm  + "/forgot-password", data, { observe: 'response' })
      .pipe(
        catchError((error: any) => {
          console.error('failed :', error);
          // Handle the error, e.g., show an error message to the user
          return error;
        })
      );
  }

  getAllRessources(url: any){
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(url,{headers:headers});
  }

  getProfile(){
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/profile/",{headers:headers});
  }

  // async getUserProfile(): Promise<KeycloakProfile> {
  //   return await this.userProfile; // Return user profile data
  // }

  async getUserProfile() {
    if (this.keycloakService.isLoggedIn()) {
      try {
        const profile = await this.keycloakService.loadUserProfile();
        this.userProfile = profile;
        console.log(this.userProfile);
        // Proceed to the next line of code here
      } catch (error) {
        console.error("Error loading user profile:", error);
        // Handle error if necessary
      }
    }
  }

  async checkRolesAndRedirect(): Promise<void> {
    await this.processModeService.ensureLoaded();
    const userRoles = await this.keycloakService.getUserRoles();
    const currentUrl = this.router.url;
    const cashierHome = this.processModeService.posEnabled ? '/pos' : '/profile';

    // Define the allowed routes for each role
    const roleRouteMap: { [key: string]: string } = {
      'ADMIN': '/',
      'VENDOR': '/',
      'WAREHOUSEMAN': '/',
      'CASHIER': cashierHome
    };
  
    // Determine if the current route is accessible for the user roles
    let hasAccess = false;
    for (const role of userRoles) {
      if (roleRouteMap[role] && currentUrl.startsWith(roleRouteMap[role])) {
        hasAccess = true;
        break;
      }
    }
  
    // If the user does not have access, redirect based on their roles
    if (!hasAccess) {
      if (userRoles.includes('ADMIN')) {
        this.router.navigate(['/']);
      } else if (userRoles.includes('VENDOR')) {
        this.router.navigate(['/']);
      } else if (userRoles.includes('WAREHOUSEMAN')) {
        this.router.navigate(['/']);
      } else if (userRoles.includes('CASHIER')) {
        this.router.navigate([cashierHome]);
      } else {
        this.router.navigate(['/auth/access']);
      }
    }
  }

  async loadUserProfile() {
    if (!this.jwt) {
      await this.loadToken();
    }
    this.userProfile = await this.keycloakService.loadUserProfile(); // Load user profile from Keycloak
  }

  getUserEvents(userId: string, maxResults: number = 100, dateFrom?: number, dateTo?: number, type?: string) {
    if (this.jwt == null) this.loadToken();
    let headers = new HttpHeaders({'authorization': 'Bearer ' + this.jwt});
    
    let url = this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.keycloakAdminSchema + '/events';
    let params = new HttpParams()
      .set('user', userId)
      .set('max', maxResults.toString());
    
    if (dateFrom) {
      params = params.set('dateFrom', dateFrom.toString());
    }
    if (dateTo) {
      params = params.set('dateTo', dateTo.toString());
    }
    if (type) {
      params = params.set('type', type);
    }
    
    return this.http.get(url, { headers: headers, params: params });
  }

}
