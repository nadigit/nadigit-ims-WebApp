import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import{ JwtHelperService } from '@auth0/angular-jwt'
import { Observable } from 'rxjs';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { KeycloakService } from 'keycloak-angular';
import { Router } from '@angular/router';

@Injectable({providedIn: 'root'})
export class AuthenticationService {

  host1:string= "http://localhost:8080/admin/realms/nadigit-ims";
  jwt?:any;
  username?:string= '';
  roles?:Array<any>=[];
  auth?:boolean= false;

  constructor(private http:HttpClient, 
              public keycloakService: KeycloakService,
              private router: Router) { }


  // login(data: any): Observable<any> {
  //   console.log('request login sent');
  //   console.log(data);
  //   return this.http.post(this.host1 + "/login", data, { observe: 'response' })
  //     .pipe(
  //       catchError((error: any) => {
  //         console.error('Login failed:', error);
  //         // Handle the error, e.g., show an error message to the user
  //         return throwError(error);
  //       })
  //     );
  // }

  registerUser(user: any){
    return this.http.post(this.host1+"/register",user,{observe:'response'})
  }

  // saveToken(jwt: any){
  //   localStorage.setItem('token',jwt);
  //   this.jwt=jwt;
  //   this.parseJWT();
  // }

  // parseJWT() {
  //   let jwtHelper = new JwtHelperService();
  //   let objJWT = jwtHelper.decodeToken(this.jwt);
  //   console.log(objJWT)
  //   // Check token expiration
  //   if (jwtHelper.isTokenExpired(this.jwt)) {
  //     console.error('Token has expired');
  //     // Handle token expiration, e.g., log out the user
  //     this.logout();
  //     return;
  //   }
  //   this.username = objJWT.sub;
  //   this.roles = objJWT.roles;
  //   console.log(this.roles);
  // }

  // isAdmin(){
  //   return this.roles.indexOf('ADMIN')>=0;
  // }

  // isUser(){
  //   return this.roles.indexOf('USER')>=0;
  // }
  // isAuthenticated(){
  //   return this.roles && (this.isAdmin()||this.isUser());   
  // }

  // isNotAuthenticated(): boolean {
  //   const notAuthenticated = !(this.jwt && this.username && this.roles);
  //   console.log('isNotAuthenticated:', notAuthenticated, 'jwt:', this.jwt, 'username:', this.username, 'roles:', this.roles);
  //   return notAuthenticated;
  // }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
    // this.jwt=localStorage.getItem('token');
    // console.log(this.jwt);
    // this.parseJWT();
  }

  // logout(){
  //   localStorage.removeItem('token');
  //   this.jwt=undefined;
  //   this.username=undefined;
  //   this.roles=undefined;
  //   this.auth=false;
  // }

  getUsers(){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host1+"/users/",{headers:headers});
  }

  getRoles(){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host1+"/roles/",{headers:headers});
  }

  getUserRoles(userId){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host1+"/users/"+userId+"/role-mappings/realm",{headers:headers});
  }

  saveUser(user: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.host1+"/users/", user, {headers:headers})
  }

  saveUserRolesMapping(userId, role){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.host1+"/users/"+userId+"/role-mappings/realm", role, {headers:headers});
  }

  deleteUserRolesMapping(userId: any, role: any): Observable<any> {
    if (this.jwt == null) {
      this.loadToken();
    }
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    // Append role data as a query parameter in the URL
    const url = `${this.host1}/users/${userId}/role-mappings/realm?role=${role}`;
    return this.http.delete(url, { headers: headers });
  }

  saveRole(role: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.host1+"/roles/", role, {headers:headers})
  }

  deleteUser(id: string){ 
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.host1+"/users/"+id,{headers:headers});
  }

  deleteRole(id: string){ 
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.host1+"/roles/"+id,{headers:headers});
  }

  updateUser(id: any, user: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.host1+"/users/"+id , user, {headers:headers});
  }

  updateRole(id: any, role: any){
    if(this.jwt==null) this.loadToken();
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.host1+"/roles/"+id , role, {headers:headers});
  }

  changePassword(values: any) {
    if(this.jwt==null) this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.post(this.host1 + "/change-password/", values, { headers: headers });
  }


  forgotPassword(data: any): Observable<any> {
    console.log('request forgot pwd sent');
    return this.http.post(this.host1 + "/forgot-password", data, { observe: 'response' })
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
    return this.http.get(this.host1+"/profile/",{headers:headers});
  }

  async checkRolesAndRedirect(): Promise<void> {
    const userRoles = await this.keycloakService.getUserRoles();
    if (userRoles.includes('ADMIN')) {
      this.router.navigate(['/']);
    } else if (userRoles.includes('VENDOR')) {
      this.router.navigate(['/pages/orders']);
    } else if (userRoles.includes('WAREHOUSEMAN')) {
      this.router.navigate(['/pages/products']);
    } else {
      this.router.navigate(['/auth/access']);
    }
  }

  getRessource(url: any){
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(url,{headers:headers});
  }


  deleteRessource(url: any){
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(url,{headers:headers});
  }


  postRessource(url: any,data: any){
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(url,data,{headers:headers});
  }


  putRessource(url: any,data: any){
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(url,data,{headers:headers});
  }

  patchRessource(url: any,data: any){
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.patch(url,data,{headers:headers});
  }

}
