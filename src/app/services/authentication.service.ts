import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { KeycloakService } from 'keycloak-angular';
import { Router } from '@angular/router';
import { KeycloakProfile } from 'keycloak-js';
import { environment } from 'src/environments/environment';

@Injectable({providedIn: 'root'})
export class AuthenticationService {

  // host1:string= environment.KcUrl+"/admin/realms/Nadigit_ims";
  kcRealm:string = "/admin/realms/Nadigit_ims"
  jwt?:any;
  username?:string= '';
  roles?:Array<any>=[];
  auth?:boolean= false;
  private userProfile: KeycloakProfile | undefined;

  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  kcHost: string = (window as any).__env.kcHost || 'localhost';
  kcPort: string = (window as any).__env.kcPort || '8080';

  constructor(private http:HttpClient, 
              public keycloakService: KeycloakService,
              private router: Router) { }

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
    return this.http.get(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/users/",{headers:headers});
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
    return this.http.get(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/roles/",{headers:headers});
  }

  getUserRoles(userId){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/users/"+userId+"/role-mappings/realm",{headers:headers});
  }

  saveUser(user: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/users/", user, {headers:headers})
  }

  saveUserRolesMapping(userId, role){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/users/"+userId+"/role-mappings/realm", role, {headers:headers});
  }

  deleteUserRolesMapping(userId: any, role: any): Observable<any> {
    if (this.jwt == null) {
      this.loadToken();
    }
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    // Append role data as a query parameter in the URL
    const url = this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +'/users/'+userId+'/role-mappings/realm?role='+role;
    return this.http.delete(url, { headers: headers });
  }

  saveRole(role: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/roles/", role, {headers:headers})
  }

  deleteUser(id: string){ 
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/users/"+id,{headers:headers});
  }

  deleteRole(id: string){ 
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/roles/"+id,{headers:headers});
  }

  updateUser(id: any, user: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/users/"+id , user, {headers:headers});
  }

  updateRole(id: any, role: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm +"/roles/"+id , role, {headers:headers});
  }

  changePassword(id: any, credentials: any) {
    if(this.jwt==null) this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.put(this.apiProtocol+'://'+this.kcHost+':'+this.kcPort+ this.kcRealm  + "/users/"+id+"/reset-password", credentials, { headers: headers });
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
    const userRoles = await this.keycloakService.getUserRoles();
    const currentUrl = this.router.url;
  
    // Define the allowed routes for each role
    const roleRouteMap: { [key: string]: string } = {
      'ADMIN': '/',
      'VENDOR': '/',
      'WAREHOUSEMAN': '/'
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


}
