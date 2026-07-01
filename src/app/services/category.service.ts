import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { environment } from 'src/environments/environment';
import { withAudit, auditSaveAction } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/stock/categories/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';
  
  constructor(private http: HttpClient, public keycloakService: KeycloakService,) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  uploadCategoryImage(file: File) {
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string; message?: string }>(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'upload-image',
      formData,
      { headers: headers }
    );
  }
  saveCategory(data: any) {
    let headers=withAudit(new HttpHeaders({'authorization':'Bearer '+this.jwt}), auditSaveAction('category', data, 'categoryId', 'categoryName'));
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema, data, {headers:headers})
  }
  updateCategory(id: any, category: any) {
    let headers=withAudit(new HttpHeaders({'authorization':'Bearer '+this.jwt}), 'Updated category');
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id , category, {headers:headers});
  }
  getCategoryDeleteImpact(id: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id+'/delete-impact', { headers });
  }
  deleteCategory(id: any, force: boolean = false) {
    let headers=withAudit(new HttpHeaders({'authorization':'Bearer '+this.jwt}), force ? 'Force deleted category' : 'Deleted category');
    let params = new HttpParams();
    if (force) {
      params = params.set('force', 'true');
    }
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id,{headers:headers, params});
  }
  getCategories() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,{headers:headers});
  }
  getProductsCategories() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'products-categories',{headers:headers});
  }
  getCategoryProducts(categoryId: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + categoryId + '/products',{headers:headers});
  }
}
