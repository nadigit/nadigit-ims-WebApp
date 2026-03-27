import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { catchError, Observable, throwError } from 'rxjs';
import { withAudit, auditSaveAction } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/organizations";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';  
  

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  saveOrganization(data: any) {
    let headers=withAudit(new HttpHeaders({'authorization':'Bearer '+this.jwt}), auditSaveAction('organization', data, 'organizationId', 'organizationName'));
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema, data, {headers:headers})
  }
  updateOrganization(id: any, supplier: any) {
    let headers=withAudit(new HttpHeaders({'authorization':'Bearer '+this.jwt}), 'Updated organization');
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+'/'+id , supplier, {headers:headers});
  }
  deleteOrganization(id: any) {
    let headers=withAudit(new HttpHeaders({'authorization':'Bearer '+this.jwt}), 'Deleted organization');
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+'/'+id,{headers:headers});
  }
  getOrganization() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,{headers:headers});
  }

  uploadLogo(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('logo', file); // Append the file to FormData

    const headers = withAudit(new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt }), 'Uploaded organization logo');
    console.log(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + '/upload-logo')

    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + '/upload-logo', formData, { headers: headers, responseType: 'text' })
      .pipe(
        catchError(error => {
          // Handle error here
          console.error('Upload failed:', error);
          return throwError(error); // Rethrow error for further handling
        })
      );
  }

  // getLogoImage(path: string): Observable<Blob> {
  //   const headers = new HttpHeaders({
  //       'Authorization': 'Bearer ' + this.jwt
  //   });
  //   // Ensure the path starts with '/' to form a valid URL
  //   const fullPath = this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + path;
  
  //   return this.http.get(fullPath, { headers: headers, responseType: 'blob' });
  // }
  
  getLogoImage(path: string): Observable<Blob> {
    const headers = new HttpHeaders({
        'Authorization': 'Bearer ' + this.jwt
    });
    const fullPath = this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + path; // Ensure localhost is correct

    return this.http.get(fullPath, { headers: headers, responseType: 'blob' });
}
}
