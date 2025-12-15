import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { FinancialDocument } from 'src/app/models/financialDocument';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { firstValueFrom } from 'rxjs';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';

@Component({
  selector: 'app-financial-document-details-page',
  templateUrl: './financial-document-details-page.component.html',
  styleUrls: ['./financial-document-details-page.component.css', '../financial-documents.component.css', '../../finance.component.css']
})
export class FinancialDocumentDetailsPageComponent implements OnInit {
  financialDocId!: number;
  financialDoc: FinancialDocument | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  organization: Organization = {};
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canRead: boolean = false;
  canIssue: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "FINANCIAL_DOCUMENTS";

  docTypes: any;
  docStatuses: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private financialDocService: FinancialDocumentsService,
    private messageService: MessageService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService,
    private organizationService: OrganizationService
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    
    // Load token first
    this.financialDocService.loadToken();
    
    // Get currency
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    // Load organization
    await this.loadOrganization();

    // Load translations
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.translate
      .getTranslation(this.translateService.getPreferredLanguage())
      .subscribe((translations) => {
        this.docTypes = [
          { label: translations['Quote'], value: 'QUOTE' },
          { label: translations['Purchase Order'], value: 'PURCHASE_ORDER' },
          { label: translations['Delivery Note'], value: 'DELIVERY_NOTE' },
          { label: translations['Return Note'], value: 'RETURN_NOTE' },
          { label: translations['Invoice'], value: 'INVOICE' },
          { label: translations['Credit Note'], value: 'CREDIT_NOTE' }
        ];

        this.docStatuses = [
          { label: translations['Draft'], value: 'DRAFT' },
          { label: translations['Issued'], value: 'ISSUED' },
          { label: translations['Cancelled'], value: 'CANCELLED' }
        ];
      });

    // Get ID from route
    this.route.params.subscribe(params => {
      this.financialDocId = +params['id'];
      if (this.financialDocId) {
        this.loadFinancialDoc();
      }
    });

    await this.checkPermissions();
  }

  async loadOrganization(): Promise<void> {
    try {
      const data = await firstValueFrom(this.organizationService.getOrganization());
      this.organization = data;
    } catch (error) {
      console.error('Error loading organization data:', error);
    }
  }

  async loadFinancialDoc() {
    try {
      const response = await firstValueFrom(this.financialDocService.getFinancialDoc(this.financialDocId));
      this.financialDoc = response as FinancialDocument;
      if (this.financialDoc?.createdAt) {
        this.financialDoc.createdAt = new Date(this.financialDoc.createdAt);
      }
      if (this.financialDoc?.issuedAt) {
        this.financialDoc.issuedAt = new Date(this.financialDoc.issuedAt);
      }
      if (this.financialDoc?.canceledAt) {
        this.financialDoc.canceledAt = new Date(this.financialDoc.canceledAt);
      }
    } catch (error: any) {
      console.error('Error loading financial document:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_financial_doc'),
        life: 3000
      });
    } finally {
      this.isLoading = false;
    }
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canEdit = this.permissionService.canUpdate(this.Ressource);
    this.canDelete = this.permissionService.canDelete(this.Ressource);
    this.canRead = this.permissionService.canReadDocs(this.Ressource);
    this.canIssue = this.permissionService.canIssueFinDocs(this.Ressource);
  }

  goBack(): void {
    this.location.back();
  }

  editFinancialDoc(): void {
    if (!this.canEdit) return;
    this.router.navigate(['/finance/financial-documents'], { 
      queryParams: { edit: this.financialDocId } 
    });
  }

  deleteFinancialDoc(): void {
    if (!this.canDelete) return;
    // Navigate back and trigger delete from list
    this.router.navigate(['/finance/financial-documents'], { 
      queryParams: { delete: this.financialDocId } 
    });
  }

  printFinancialDoc(): void {
    if (this.financialDoc?.docNumber) {
      this.financialDocService.printFinancialDoc(this.financialDoc.docNumber);
    }
  }

  viewOrder(): void {
    if (this.financialDoc?.order?.orderId) {
      this.router.navigate(['/sales/orders', this.financialDoc.order.orderId]);
    }
  }

  getDocTypeLabel(docType: string | undefined): string {
    if (!docType) return 'N/A';
    const docTypeObj = this.docTypes?.find((dt: any) => dt.value === docType);
    return docTypeObj?.label || docType;
  }

  getDocStatusLabel(docStatus: string | undefined): string {
    if (!docStatus) return 'N/A';
    const docStatusObj = this.docStatuses?.find((ds: any) => ds.value === docStatus);
    return docStatusObj?.label || docStatus;
  }

  getDocStatusSeverity(docStatus: string | undefined): string {
    if (!docStatus) return 'secondary';
    switch (docStatus.toUpperCase()) {
      case 'DRAFT':
        return 'warning';
      case 'ISSUED':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getDocStatusIcon(docStatus: string | undefined): string {
    if (!docStatus) return 'pi pi-circle';
    switch (docStatus.toUpperCase()) {
      case 'DRAFT':
        return 'pi pi-file-edit';
      case 'ISSUED':
        return 'pi pi-check-circle';
      case 'CANCELLED':
        return 'pi pi-times-circle';
      default:
        return 'pi pi-circle';
    }
  }

  getDocTypeIcon(docType: string | undefined): string {
    if (!docType) return 'pi pi-file';
    switch (docType.toUpperCase()) {
      case 'QUOTE':
        return 'pi pi-file';
      case 'PURCHASE_ORDER':
        return 'pi pi-shopping-cart';
      case 'DELIVERY_NOTE':
        return 'pi pi-truck';
      case 'RETURN_NOTE':
        return 'pi pi-undo';
      case 'INVOICE':
        return 'pi pi-file-pdf';
      case 'CREDIT_NOTE':
        return 'pi pi-file-edit';
      default:
        return 'pi pi-file';
    }
  }

  getOrderTotal(): number {
    return this.financialDoc?.order?.orderItems?.reduce((sum, item) => 
      sum + (item.pricePerUnit * item.quantity), 0) || 0;
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  getCustomerDisplayName(customer: any): string {
    if (!customer) return 'N/A';
    if (customer.companyName) {
      return customer.companyName;
    }
    const firstName = customer.firstName || '';
    const lastName = customer.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'N/A';
  }
}

