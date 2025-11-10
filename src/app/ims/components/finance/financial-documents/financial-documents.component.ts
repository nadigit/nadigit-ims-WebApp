import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { FinancialDocument } from 'src/app/models/financialDocument';
import { Order } from 'src/app/models/order';
import { Organization } from 'src/app/models/organization';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { OrderService } from 'src/app/services/order.service';
import { OrganizationService } from 'src/app/services/organization.service';
import { PermissionService } from 'src/app/services/permission.service';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';

@Component({
  templateUrl: './financial-documents.component.html',
  styleUrls: ['../finance.component.css', './financial-documents.component.css'],
  providers: [MessageService]
})
export class FinancialDocumentsComponent implements OnInit {

  Ressource: string = "FINANCIAL_DOCUMENTS"

  draftFinancialDocDialog: boolean = false;

  financialDocDetailsDialog: boolean = false;

  deleteFinancialDocDialog: boolean = false;

  deleteFinancialDocsDialog: boolean = false;

  issueFinancialDocDialog: boolean = false;

  financialDocs: FinancialDocument[] = [];

  financialDoc: FinancialDocument = {};

  selectedFinancialDocs: FinancialDocument[] = [];

  submitted: boolean = false;

  cols: any[] = [];
  orderItems: any[] = [];

  organization: Organization = {};

  rowsPerPageOptions = [20, 50, 100];

  exportColumns!: ExportColumn[];

  orders: Order[] = [];

  docTypeSequences: { [key: string]: number } = {};


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
  docTypes: any;
  docStatuses: any;

  loadingOrders: boolean = false;
  cancelFinancialDocDialog: boolean = false;


  constructor(private messageService: MessageService,
    private financialDocService: FinancialDocumentsService,
    private orderService: OrderService,
    private reportingService: ReportingService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translate: TranslateService,
    private organizationService: OrganizationService,
    private translateService: TranslationService,
    private permissionService: PermissionService,) {
    this.setUserRoles()
    this.loadOrganization();
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

    await this.checkPermissions();
    this.onGetAllFinancialDocs();

    this.cols = [
      { field: 'categoryId', header: this.translateService.instant('category_id') },
      { field: 'categoryName', header: this.translateService.instant('category_name') },
      { field: 'description', header: this.translateService.instant('category_description') }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

  }

  async loadOrganization(): Promise<void> {
    try {
      const data = await firstValueFrom(this.organizationService.getOrganization());
      this.organization = data;
      console.log(this.organization);
    } catch (error) {
      console.error('Error loading organization data:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_organization_data'),
        life: 3000
      });
    }
  }

  generateDocNumber() {
    if (!this.financialDoc.docType) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('select_document_type_first'),
        life: 3000
      });
      return;
    }

    // Map from docType to hardcoded prefix
    const docTypeToPrefix: any = {
      QUOTE: "Q",
      PURCHASE_ORDER: "PO",
      DELIVERY_NOTE: "DN",
      RETURN_NOTE: "RN",
      INVOICE: "INV",
      CREDIT_NOTE: "CN"
    };

    const hardPrefix = docTypeToPrefix[this.financialDoc.docType] || "DOC";

    // Use the organization's default locale to fetch translations
    const orgLocale = this.organization?.defaultLocale || 'en';

    this.translate.getTranslation(orgLocale).subscribe((translations) => {
      // translations should contain PREFIX.{hardPrefix} for all locales
      const translatedPrefix = translations?.PREFIX?.[hardPrefix] || hardPrefix;

      // Increment sequence
      if (!this.docTypeSequences[this.financialDoc.docType]) {
        this.docTypeSequences[this.financialDoc.docType] = 1;
      } else {
        this.docTypeSequences[this.financialDoc.docType]++;
      }
      const sequence = String(this.docTypeSequences[this.financialDoc.docType]).padStart(3, '0');

      // Date part
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      // Final document number with organization-default translation
      this.financialDoc.docNumber = `${translatedPrefix}-${datePart}-${sequence}`;
    });
  }


  deleteSelectedFinancialDocs() {
    if (!this.canDeleteFinancialDocs) return;
    this.deleteFinancialDocsDialog = true;
  }

  editFinancialDoc(financialDoc: FinancialDocument) {
    if (!this.canEditFinancialDocs) return;
    this.financialDoc = { ...financialDoc };
    this.draftFinancialDocDialog = true;
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

  cancelFinancialDoc(financialDoc: FinancialDocument) {
    if (!this.canEditFinancialDocs) return;
    this.cancelFinancialDocDialog = true;
    this.financialDoc = { ...financialDoc };
  }

  confirmIssueDocument() {
    this.issueFinancialDocDialog = false;

    this.onIssueFinancialDoc(this.financialDoc.financialDocId);
    this.financialDoc = {};
  }

  openIssuedPdf(doc: any): void {
    this.financialDocService.printFinancialDoc(doc.docNumber);
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
    this.canReadFinancialDocs = this.permissionService.canReadDocs(this.Ressource);
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
    this.draftFinancialDocDialog = false;
    this.submitted = false;
  }

  openNew() {
    if (!this.canAddFinancialDocs) return;
    this.financialDoc = {};
    this.submitted = false;
    this.draftFinancialDocDialog = true;
  }

  onDocTypeChange(selectedType: DocumentType) {
    if (!selectedType) {
      this.orders = [];
      this.financialDoc.order = null;
      this.financialDoc.docTitle = '';
      return;
    }

    // Use org’s default locale
    const orgLocale = this.organization?.defaultLocale || 'en';

    this.translate.getTranslation(orgLocale).subscribe((translations) => {
      // Look up a label for this docType in translations
      // Example: INVOICE -> "Facture", QUOTE -> "Devis"
      const translatedTitle = translations[String(selectedType)] || String(selectedType);

      // Only auto-fill if the user hasn’t already typed something
      if (!this.financialDoc.docTitle || this.financialDoc.docTitle.trim() === '') {
        this.financialDoc.docTitle = translatedTitle;
      }
    });

    this.getEligibleOrdersForDocType(selectedType);
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

    if (this.financialDoc.docType) {
      if (this.financialDoc.financialDocId) {
        // UPDATE
        try {
          await this.updateFinancialDoc(this.financialDoc.financialDocId, this.financialDoc);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('document_updated_successfully'),
            life: 3000
          });
        } catch (error) {
          console.error('Error updating financial doc:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_updating_document'),
            life: 3000
          });
        }
      } else {
        // ADD NEW
        try {
          await this.addFinancialDoc(this.financialDoc);
        } catch (error) {
          console.error('Error adding financial doc:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_creating_document'),
            life: 3000
          });
        }
      }

      // Refresh list
      this.financialDocs = [...this.financialDocs];
      this.draftFinancialDocDialog = false;
      this.financialDoc = {};
      this.submitted = false;

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
    // Construct payload with only the issuing fields
    const issuePayload = {
      dueDate: this.financialDoc.dueDate,
      validityDays: this.financialDoc.validityDays,
      paymentTerms: this.financialDoc.paymentTerms,
      requiresSignature: this.financialDoc.requiresSignature,
      additionalReferences: this.financialDoc.additionalReferences
    };

    this.financialDocService.issueFinancialDoc(id, issuePayload).subscribe({
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

  async confirmCancelFinancialDoc(): Promise<any> {
    await this.financialDocService.cancelFinancialDoc(this.financialDoc.financialDocId)
      .subscribe({
        next: (response: any) => {
          this.onGetAllFinancialDocs();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('financial_doc_cancelled'),
            life: 3000
          });
          return true;
        },
        error(err: any) {
          console.log(err);
          this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_cancelling_financial_doc'), life: 3000 })
          return false;
        },
      })

    this.cancelFinancialDocDialog = false;
    this.financialDoc = {};
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

  getEligibleOrdersForDocType(docType: DocumentType) {
    this.loadingOrders = true;
    this.orderService.getEligibleOrdersForDocsByType(docType).subscribe({
      next: (orders: Order[]) => {
        this.orders = orders;
        this.loadingOrders = false;

        // ✅ If there are no eligible orders, show a nice message
        if (!orders || orders.length === 0) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('no_orders_available'),
            detail: this.translate.instant('no_eligible_orders_for_type', { type: docType }),
            life: 4000
          });
        }
      },
      error: (err) => {
        console.error('Error fetching orders', err);
        this.loadingOrders = false;
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

  updateValidityDays() {
    if (this.financialDoc.dueDate) {
      const today = new Date(); // You can replace this with a custom reference date if needed
      const dueDate = new Date(this.financialDoc.dueDate);

      // Calculate difference in days
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // convert ms to days

      // Ensure non-negative value
      this.financialDoc.validityDays = diffDays > 0 ? diffDays : 0;
    } else {
      this.financialDoc.validityDays = 0;
    }
  }

}
