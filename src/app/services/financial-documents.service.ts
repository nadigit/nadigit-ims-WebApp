import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

@Injectable({
  providedIn: 'root'
})
export class FinancialDocumentsService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/financial-documents/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';


    constructor(private http: HttpClient, public keycloakService: KeycloakService,) { }
  
    loadToken(){
      this.jwt = this.keycloakService.getToken();
    }
  
    saveFinancialDoc(data: any) {
      let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
      return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema, data, {headers:headers})
    }

    updateFinancialDoc(id: any, financialDoc: any) {
      let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
      return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id , financialDoc, {headers:headers});
    }

    issueFinancialDoc(id: any) {
      let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
      return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema + id + '/issue', {headers:headers});
    }
    
    deleteFinancialDoc(id: any) {
      let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
      return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id,{headers:headers});
    }

    getFinancialDocs() {
      let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
      return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,{headers:headers});
    }

  printFinancialDoc(doc: any) {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/files/${doc.docNumber}.pdf`;

    const headers = new HttpHeaders({
      Authorization: 'Bearer ' + this.jwt
    });

    this.http.get(url, { headers, responseType: 'blob' }).subscribe(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    }, error => {
      console.error('Error downloading file:', error);
    });
  }
}
