import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, map, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppConfigurationService {

  jwt: any;
  host2:string= "http://localhost:8090";
  schema: string = "/app-configs/";
  
  constructor(private http: HttpClient, public keycloakService: KeycloakService,) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  saveConfiguration(data: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.host2+this.schema, data, {headers:headers})
  }

  getConfiguration(key:any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema + key,{headers:headers});
  }

  getConfigurationValue(key: any): Observable<string> {
    let headers = new HttpHeaders({'authorization': 'Bearer ' + this.jwt});
    return this.http.get(this.host2 + this.schema + key + '/value', { headers: headers, responseType: 'text' })
      .pipe(
        map(response => {
          try {
            return JSON.parse(response).value;
          } catch (e) {
            // Handle the case where response is not JSON
            return response;
          }
        }),
        catchError((error) => {
          console.error('Error fetching configuration value:', error);
          if (error.error) {
            console.error('Error response body:', error.error);
          }
          return throwError(error);
        })
      );
  }

  getAllConfigurations() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema,{headers:headers});
  }
  
}
