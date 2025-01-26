import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AppConfigurationService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/app-configs/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';
  
  constructor(private http: HttpClient, private keycloakService: KeycloakService) {
    this.loadToken();
  }

  async loadToken() {
    if (!this.jwt) {
      try {
        this.jwt = await this.keycloakService.getToken();
      } catch (error) {
        console.error('Error loading token:', error);
      }
    }
  }

  private async getHeaders(): Promise<HttpHeaders> {
    if (!this.jwt) {
      await this.loadToken(); // Ensure token is loaded
    }
    return new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
  }

  async saveConfiguration(data: any): Promise<Observable<any>> {
    const headers = await this.getHeaders();
    return this.http.post(
      this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema,
      data,
      { headers }
    );
  }
  
  // async saveConfiguration(data: any) {
  //   if (!this.jwt) {
  //     await this.loadToken();
  //   }
  //   let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
  //   return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema, data, {headers:headers})
  // }

  // getConfiguration(key:any) {
  //   let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
  //   return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + key,{headers:headers});
  // }

  async getConfiguration(key: any): Promise<Observable<any>> {
    const headers = await this.getHeaders();
    return this.http.get(
      this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + key,
      { headers }
    );
  }

  // getConfigurationValue(key: any): Observable<string> {
  //   let headers = new HttpHeaders({'authorization': 'Bearer ' + this.jwt});
  //   return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + key + '/value', { headers: headers, responseType: 'text' })
  //     .pipe(
  //       map(response => {
  //         try {
  //           return JSON.parse(response).value;
  //         } catch (e) {
  //           // Handle the case where response is not JSON
  //           return response;
  //         }
  //       }),
  //       catchError((error) => {
  //         console.error('Error fetching configuration value:', error);
  //         if (error.error) {
  //           console.error('Error response body:', error.error);
  //         }
  //         return throwError(error);
  //       })
  //     );
  // }

  async getConfigurationValue(key: any): Promise<Observable<string>> {
    const headers = await this.getHeaders();
    return this.http.get(
      this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + key + '/value',
      { headers, responseType: 'text' }
    ).pipe(
      map(response => {
        try {
          return JSON.parse(response).value;
        } catch {
          return response; // Handle non-JSON response
        }
      }),
      catchError(error => {
        console.error('Error fetching configuration value:', error);
        return throwError(error);
      })
    );
  }

  // getAllConfigurations() {
  //   let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
  //   return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,{headers:headers});
  // }

  async getAllConfigurations(): Promise<Observable<any>> {
    const headers = await this.getHeaders();
    return this.http.get(
      this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,
      { headers }
    );
  }
  
}
