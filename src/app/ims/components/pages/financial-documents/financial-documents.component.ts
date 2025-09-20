import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { FinancialDocument } from 'src/app/models/financialDocument';
import { Order } from 'src/app/models/order';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { OrderService } from 'src/app/services/order.service';
import { PermissionService } from 'src/app/services/permission.service';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';

@Component({
  templateUrl: './financial-documents.component.html',
  styleUrls: ['../pages.component.css', './financial-documents.component.css'],
  providers: [MessageService]
})
export class FinancialDocumentsComponent implements OnInit {

  Ressource: string = "FINANCIAL_DOCUMENTS"

  financialDocDialog: boolean = false;

  financialDocDetailsDialog : boolean = false;

  deleteFinancialDocDialog: boolean = false;

  deleteFinancialDocsDialog: boolean = false;

  issueFinancialDocDialog: boolean = false;

  financialDocs: FinancialDocument[] = [];

  financialDoc: FinancialDocument = {};

  selectedFinancialDocs: FinancialDocument[] = [];

  submitted: boolean = false;

  cols: any[] = [];
  orderItems: any[] = [];


  rowsPerPageOptions = [20, 50, 100];

  exportColumns!: ExportColumn[];

  orders: Order[] = [];

  // Permissions
  canAddFinancialDocs: boolean = false;
  canEditFinancialDocs: boolean = false;
  canDeleteFinancialDocs: boolean = false;
  canReadFinancialDocs: boolean = false;
  canIssueFinancialDocs: boolean = false;
  isAdmin: boolean = false;
  isLoading = true;
  currency: string = '';
  userRoles: any;


  docTypes = [
    { label: 'Quote', value: 'QUOTE' },
    { label: 'Purchase Order', value: 'PURCHASE_ORDER' },
    { label: 'Delivery Note', value: 'DELIVERY_NOTE' },
    { label: 'Return Note', value: 'RETURN_NOTE' },
    { label: 'Invoice', value: 'INVOICE' },
    { label: 'Credit Note', value: 'CREDIT_NOTE' }
  ];

  docStatuses = [
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Issued', value: 'ISSUED' },
    { label: 'Cancelled', value: 'CANCELLED' }
  ];

  constructor(private messageService: MessageService,
    private financialDocService: FinancialDocumentsService,
    private orderService: OrderService,
    private reportingService: ReportingService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,) {
      this.setUserRoles();
     }

  async ngOnInit() {
    this.isLoading = true;
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    await this.checkPermissions();
    this.onGetAllFinancialDocs();

    this.cols = [
      { field: 'categoryId', header: this.translateService.instant('category_id') },
      { field: 'categoryName', header: this.translateService.instant('category_name') },
      { field: 'description', header: this.translateService.instant('category_description') }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

  }

  deleteSelectedFinancialDocs() {
    if (!this.canDeleteFinancialDocs) return;
    this.deleteFinancialDocsDialog = true;
  }

  editFinancialDoc(financialDoc: FinancialDocument) {
    if (!this.canEditFinancialDocs) return;
    this.onGetAllOrders();
    this.financialDoc = { ...financialDoc };
    this.financialDocDialog = true;
  }

  deleteFinancialDoc(financialDoc: FinancialDocument) {
    if (!this.canDeleteFinancialDocs) return;
    this.deleteFinancialDocDialog = true;
    this.financialDoc = { ...financialDoc };
  }

  issueFinancialDoc(financialDoc: FinancialDocument) {
    if (!this.canIssueFinancialDocs) return;
    this.issueFinancialDocDialog = true;
    this.financialDoc = { ...financialDoc };
  }

  confirmIssueDocument() {
    this.issueFinancialDocDialog = false;

    this.onIssueFinancialDoc(this.financialDoc.financialDocId);
    this.financialDoc = {};
  }

  openIssuedPdf(doc: any): void {
    this.financialDocService.printFinancialDoc(doc);
  }


  async confirmDeleteSelected() {
    this.deleteFinancialDocsDialog = false;
    let hasError = false;
    for (const selectedFinancialDoc of this.selectedFinancialDocs) {
      try {
        await this.onDeleteFinancialDoc(selectedFinancialDoc.docNumber);
      } catch (error) {
        hasError = true;
        console.error('Error deleting Financial Doc:', error);
      }
    }

    if (!hasError) {
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('financial_docs_deleted'),
        life: 3000
      });
    }
    this.selectedFinancialDocs = [];
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canAddFinancialDocs = this.permissionService.canCreate(this.Ressource);
    this.canEditFinancialDocs = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteFinancialDocs = this.permissionService.canDelete(this.Ressource);
    this.canReadFinancialDocs = this.permissionService.canListProducts(this.Ressource);
    this.canIssueFinancialDocs = this.permissionService.canIssueFinDocs(this.Ressource)
  }

  async confirmDelete() {
    this.deleteFinancialDocDialog = false;
    try {
      await this.onDeleteFinancialDoc(this.financialDoc.docNumber);
      this.financialDoc = {};
    } catch (error) {
      console.error('Error deleting financial doc:', error);
    }
  }

  hideDialog() {
    this.financialDocDialog = false;
    this.submitted = false;
  }

  openNew() {
    if (!this.canAddFinancialDocs) return;
    this.onGetAllOrders();
    this.financialDoc = {};
    this.submitted = false;
    this.financialDocDialog = true;
  }

  async viewFinancialDocDetailsDialog(financialDoc: FinancialDocument) {
    this.financialDoc = financialDoc;
    this.financialDocDetailsDialog = true;
  }

  hideFinancialDocDetailsDialog() {
    this.financialDoc = {};
    this.financialDocDetailsDialog = false;
  }

  async saveFinancialDoc() {
    this.submitted = true;
    if (this.financialDoc.docNumber) {
      if (this.financialDoc.financialDocId) {
        try {
          await this.updateFinancialDoc(this.financialDoc.financialDocId, this.financialDoc);
        } catch (error) {
          console.error('Error updating financial doc:', error);
        }
      } else {
        try {
          await this.addFinancialDoc(this.financialDoc);
        } catch (error) {
          console.error('Error adding financial doc:', error);
        }
      }
      this.financialDocs = [...this.financialDocs];
      this.financialDocDialog = false;
      this.financialDoc = {};
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  async onGetAllFinancialDocs() {
    this.financialDocService.getFinancialDocs()
      .subscribe({
        next: (response: any) => {
          this.financialDocs = response;
          console.log(this.financialDoc);
          this.financialDocs.forEach((financialDoc: any) => (financialDoc.creationDate = new Date(<Date>financialDoc.creationDate)));
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_getting_financial_docs'), life: 3000 });
          console.log(err);
        },
        complete: () => {
          this.isLoading = false;
        }
      })
  }

  async onDeleteFinancialDoc(id: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.financialDocService.deleteFinancialDoc(id)
        .subscribe({
          next: (response: any) => {
            this.onGetAllFinancialDocs();
            this.messageService.add({
              severity: 'success',
              summary: this.translate.instant('successful'),
              detail: this.translate.instant('financial_doc_deleted'),
              life: 3000
            });
            resolve();
          },
          error: (err: any) => {
            this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_deleting_financial_doc'), life: 3000 });
            console.log(err);
            reject(err);
          }
        });
    });
  }

  onIssueFinancialDoc(id: any) {
    this.financialDocService.issueFinancialDoc(id).subscribe({
      next: (response: any) => {
        this.onGetAllFinancialDocs();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('financial_doc_issued'),
          life: 3000
        });
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_issuing_financial_doc'),
          life: 3000
        });
      }
    });
  }

  async updateFinancialDoc(id: any, financialDoc: any): Promise<any> {
    await this.financialDocService.updateFinancialDoc(id, financialDoc)
      .subscribe({
        next: (response: any) => {
          this.onGetAllFinancialDocs();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('financial_doc_updated'),
            life: 3000
          });
          return true;
        },
        error(err: any) {
          console.log(err);
          this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_updating_financial_doc'), life: 3000 })
          return false;
        },
      })
  }

  async addFinancialDoc(data: any): Promise<any> {
    await this.financialDocService.saveFinancialDoc(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllFinancialDocs();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('financial_doc_created'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_financial_doc'),
            life: 3000
          });
          return false;
        },
      });
  }

  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.financialDocs, 'financialDocs')
  }

  exportExcel() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedFinancialDocs = this.financialDocs.map(financialDoc => {
      // Create a copy of the supplier object to modify
      const modifiedFinancialDoc = { ...financialDoc };

      // Remove the column you want to exclude
      delete modifiedFinancialDoc.createdAt;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedFinancialDoc;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedFinancialDocs, 'financialDocs');
  }

  
  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }
  
  getOrderTotal(): number {
    return this.orderItems?.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) || 0;
  }

  onGetAllOrders() {
    this.orderService.getOrders().subscribe({
      next: (orders: Order[]) => {
        console.log(orders);
        this.orders = orders;
      },
      error: (err) => {
        console.error('Error fetching orders', err);
        this.orders = [];
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_fetching_orders'),
          life: 3000
        });
      }
    });
  }

}
