import { Component, OnInit, ViewChild, OnDestroy, SecurityContext, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { MessageService, LazyLoadEvent } from 'primeng/api';
import { Table } from 'primeng/table';
import { firstValueFrom, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, catchError } from 'rxjs/operators';
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
import { DatePipe } from '@angular/common';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

@Component({
  templateUrl: './financial-documents.component.html',
  styleUrls: ['../finance.component.css', './financial-documents.component.css'],
  providers: [MessageService, DatePipe]
})
export class FinancialDocumentsComponent implements OnInit, OnDestroy {

  Ressource: string = "FINANCIAL_DOCUMENTS"

  draftFinancialDocDialog: boolean = false;


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
  orderSuggestions: Order[] = []; // For autocomplete suggestions
  totalOrders: number = 0; // Total orders for lazy loading
  orderSuggestionsLoading: boolean = false;
  latestOrderSuggestionToken: number = 0;

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

  // Filter properties
  selectedDocType: string | null = null;
  selectedDocStatus: string | null = null;
  selectedOrigin: string | null = null;
  selectedOrder: Order | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  globalFilter: string = '';
  
  // Lazy loading properties
  totalRecords: number = 0;
  lastLazyLoadEvent: LazyLoadEventExt = {
    first: 0,
    rows: 20,
    sortField: 'createdAt',
    sortOrder: -1
  };
  
  isExporting: boolean = false;
  exportProgress: string = '';
  
  originOptions = [
    { label: 'POS', value: 'POS' },
    { label: 'Back Office', value: 'BACK_OFFICE' }
  ];

  loadingOrders: boolean = false;
  cancelFinancialDocDialog: boolean = false;

  // Preview properties
  previewHtml: string = '';
  safePreviewHtml: SafeHtml | null = null;
  previewLoading: boolean = false;
  previewError: string | null = null;
  previewIframeSrc: SafeHtml | null = null;
  private previewUpdateSubject = new Subject<any>();
  private destroy$ = new Subject<void>();
  private previewStyleId: string = 'financial-doc-preview-styles';
  
  // API configuration for file URLs
  apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  apiHost: string = (window as any).__env?.apiHost || 'localhost';
  apiPort: string = (window as any).__env?.apiPort || '8090';


  constructor(private messageService: MessageService,
    private financialDocService: FinancialDocumentsService,
    private orderService: OrderService,
    private reportingService: ReportingService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translate: TranslateService,
    private organizationService: OrganizationService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe) {
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
          { label: translations['Proforma Invoice'] || 'Proforma Invoice', value: 'PROFORMA_INVOICE' },
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
    
    this.cols = [
      { field: 'docNumber', header: this.translateService.instant('document_number') },
      { field: 'docTitle', header: this.translateService.instant('document_title') },
      { field: 'docType', header: this.translateService.instant('document_type') },
      { field: 'docStatus', header: this.translateService.instant('document_status') },
      { field: 'createdAt', header: this.translateService.instant('creation_date') },
      { field: 'issuedAt', header: this.translateService.instant('issued_date') },
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
    
    // Load first page of financial documents
    await this.loadFinancialDocs();

    // Setup preview update subscription with debounce
    this.previewUpdateSubject
      .pipe(
        debounceTime(500), // Wait 500ms after last change before making API call
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
        switchMap((previewData) => {
          this.previewLoading = true;
          this.previewError = null;
          return this.financialDocService.getDocumentPreview(previewData).pipe(
            catchError((error) => {
              this.handlePreviewError(error);
              return of(null);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((response: any) => {
        this.previewLoading = false;
        if (response && response.html) {
          this.previewHtml = this.processPreviewHtml(response.html);
          this.safePreviewHtml = this.sanitizer.sanitize(SecurityContext.HTML, this.previewHtml);
          this.previewError = null;
          this.cdr.detectChanges();
        } else if (response === null) {
          // Error already handled in catchError
        } else {
          this.previewError = this.translate.instant('error_loading_preview') || 'Failed to load preview';
          this.previewHtml = '';
          this.safePreviewHtml = null;
          this.previewIframeSrc = null;
        }
      });

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
      PROFORMA_INVOICE: "PF",
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
    
    // Reset preview state before opening dialog
    this.previewHtml = '';
    this.safePreviewHtml = null;
    this.previewIframeSrc = null;
    this.previewError = null;
    this.previewLoading = false;
    
    this.issueFinancialDocDialog = true;
    this.financialDoc = { ...financialDoc };
    
    // Initialize document date to today if not set
    if (!this.financialDoc.documentDate) {
      this.financialDoc.documentDate = new Date();
    } else if (typeof this.financialDoc.documentDate === 'string') {
      this.financialDoc.documentDate = new Date(this.financialDoc.documentDate);
    }
    
    // Convert string dates to Date objects if needed
    if (this.financialDoc.dueDate && typeof this.financialDoc.dueDate === 'string') {
      this.financialDoc.dueDate = new Date(this.financialDoc.dueDate);
    }
    if (this.financialDoc.deliveryDate && typeof this.financialDoc.deliveryDate === 'string') {
      this.financialDoc.deliveryDate = new Date(this.financialDoc.deliveryDate);
    }
    if (this.financialDoc.validityStartDate && typeof this.financialDoc.validityStartDate === 'string') {
      this.financialDoc.validityStartDate = new Date(this.financialDoc.validityStartDate);
    }
    if (this.financialDoc.validityEndDate && typeof this.financialDoc.validityEndDate === 'string') {
      this.financialDoc.validityEndDate = new Date(this.financialDoc.validityEndDate);
    }

    // Preview will be loaded in onIssueDialogShow() when dialog is fully rendered
  }

  onIssueDialogShow() {
    // Load preview when dialog is fully shown
    setTimeout(() => {
      // Ensure preview state is clean before loading
      this.previewError = null;
      this.previewLoading = false;
      this.loadDocumentPreview();
    }, 100);
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

  onIssueDialogHide() {
    // Clean up preview when dialog closes
    this.previewHtml = '';
    this.safePreviewHtml = null;
    this.previewIframeSrc = null;
    this.previewError = null;
    this.previewLoading = false;
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

  viewFinancialDocDetailsDialog(financialDoc: FinancialDocument) {
    if (!this.canReadFinancialDocs) return;
    this.router.navigate(['/finance/financial-documents', financialDoc.financialDocId]);
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

  @ViewChild('dt') dt!: Table;

  onLazyLoad(event: LazyLoadEvent) {
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.loadFinancialDocs();
  }

  updateLastLazyLoadEvent(event: LazyLoadEventExt) {
    this.lastLazyLoadEvent = {
      first: event.first || 0,
      rows: event.rows || 20,
      sortField: event.sortField || 'createdAt',
      sortOrder: event.sortOrder || -1,
      globalFilter: event.globalFilter || this.globalFilter,
      filters: event.filters || this.lastLazyLoadEvent.filters || {}
    };
  }

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.globalFilter = value;
    this.lastLazyLoadEvent.first = 0;
    this.loadFinancialDocs();
  }

  onFilterChange() {
    this.applyFilters();
  }

  applyFilters() {
    const filters: any = {};

    if (this.selectedDocType) {
      filters['docType'] = { value: this.selectedDocType, matchMode: 'equals' };
    }

    if (this.selectedDocStatus) {
      filters['docStatus'] = { value: this.selectedDocStatus, matchMode: 'equals' };
    }
    
    if (this.selectedOrigin) {
      filters['origin'] = { value: this.selectedOrigin, matchMode: 'equals' };
    }
    
    if (this.selectedOrder) {
      filters['orderId'] = { value: this.selectedOrder, matchMode: 'equals' };
    }
    
    if (this.startDate) {
      filters['documentDateFrom'] = { value: this.startDate, matchMode: 'dateIs' };
    }
    
    if (this.endDate) {
      filters['documentDateTo'] = { value: this.endDate, matchMode: 'dateIs' };
    }
    
    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      filters: filters
    };
    
    this.updateLastLazyLoadEvent(lazyEvent);
    this.loadFinancialDocs();
  }

  clearFilters() {
    this.selectedDocType = null;
    this.selectedDocStatus = null;
    this.selectedOrigin = null;
    this.selectedOrder = null;
    this.startDate = null;
    this.endDate = null;
    this.globalFilter = '';
    
    this.lastLazyLoadEvent.first = 0;
    this.lastLazyLoadEvent.filters = {};
    
    const resetEvent: LazyLoadEvent = {
      first: 0,
      rows: this.lastLazyLoadEvent.rows || 20,
      sortField: 'createdAt',
      sortOrder: -1
    };
    
    this.onLazyLoad(resetEvent);
  }

  loadFinancialDocs() {
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === 1 ? 'ASC' : 'DESC';
    
    // Pass filters as-is - the service expects { field: { value: ..., matchMode: ... } } format
    const filterPayload = filters || {};

    this.financialDocService.getFinancialDocsPaginated(
      page,
      size,
      globalFilter || '',
      sortField!,
      direction,
      filterPayload
    ).subscribe({
      next: (res: any) => {
        // Assign the paginated financial documents
        this.financialDocs = res.page.content.map((doc: any) => {
          return {
            ...doc,
            creationDate: doc.createdAt ? new Date(doc.createdAt) : null,
            createdAt: doc.createdAt ? new Date(doc.createdAt) : null,
            issuedAt: doc.issuedAt ? new Date(doc.issuedAt) : null
          };
        });

        // Assign total records from backend
        this.totalRecords = res.totalDocuments || res.page?.totalElements || 0;

        this.isLoading = false;
        
        // Trigger change detection to ensure table updates
        if (this.cdr) {
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => {
        console.error(err);
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_getting_financial_docs'),
          life: 3000
        });
      }
    });
  }

  async onGetAllFinancialDocs() {
    // For backward compatibility, call loadFinancialDocs
    this.loadFinancialDocs();
  }

  async onDeleteFinancialDoc(id: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.financialDocService.deleteFinancialDoc(id)
        .subscribe({
          next: (response: any) => {
            this.loadFinancialDocs();
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
    const issuePayload: any = {
      documentDate: this.financialDoc.documentDate ? (this.financialDoc.documentDate instanceof Date 
        ? this.formatDateLocal(this.financialDoc.documentDate) 
        : this.financialDoc.documentDate) : undefined,
      dueDate: this.financialDoc.dueDate ? (this.financialDoc.dueDate instanceof Date 
        ? this.formatDateLocal(this.financialDoc.dueDate) 
        : this.financialDoc.dueDate) : undefined,
      deliveryDate: this.financialDoc.deliveryDate ? (this.financialDoc.deliveryDate instanceof Date 
        ? this.formatDateLocal(this.financialDoc.deliveryDate) 
        : this.financialDoc.deliveryDate) : undefined,
      validityStartDate: this.financialDoc.validityStartDate ? (this.financialDoc.validityStartDate instanceof Date 
        ? this.formatDateLocal(this.financialDoc.validityStartDate) 
        : this.financialDoc.validityStartDate) : undefined,
      validityEndDate: this.financialDoc.validityEndDate ? (this.financialDoc.validityEndDate instanceof Date 
        ? this.formatDateLocal(this.financialDoc.validityEndDate) 
        : this.financialDoc.validityEndDate) : undefined,
      validityDays: this.financialDoc.validityDays,
      paymentTermsDays: this.financialDoc.paymentTermsDays,
      paymentTerms: this.financialDoc.paymentTerms,
      requiresSignature: this.financialDoc.requiresSignature,
      additionalReferences: this.financialDoc.additionalReferences,
      notes: this.financialDoc.notes
    };
    
    // Remove undefined values
    Object.keys(issuePayload).forEach(key => {
      if (issuePayload[key] === undefined) {
        delete issuePayload[key];
      }
    });

    this.financialDocService.issueFinancialDoc(id, issuePayload).subscribe({
      next: (response: any) => {
        this.loadFinancialDocs();
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
          this.loadFinancialDocs();
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
          this.loadFinancialDocs();
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
          this.loadFinancialDocs();
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

  async exportPdf() {
    if (this.isExporting) { return; }
    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_pdf_please_wait') || 'Exporting PDF, please wait...',
        life: 3000
      });

      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      await firstValueFrom(this.translate.getTranslation(defaultLocale));

      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredDocs: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMorePages = true;
      const maxPages = 100;

      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === -1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };

      this.financialDocService.loadToken();

      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.financialDocService.getFinancialDocsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'createdAt',
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || [];
        allFilteredDocs = allFilteredDocs.concat(pageContent);

        const totalElements = response.page?.totalElements || response.totalElements || 0;
        hasMorePages = allFilteredDocs.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      if (allFilteredDocs.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('no_data_to_export') || 'No data available to export',
          life: 3000
        });
        this.isExporting = false;
        this.exportProgress = '';
        this.translate.use(currentLang);
        return;
      }

      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';

      const exportColumns: ExportColumn[] = [
        { title: this.translate.instant('document_number'), dataKey: 'docNumber' },
        { title: this.translate.instant('document_title'), dataKey: 'docTitle' },
        { title: this.translate.instant('document_type'), dataKey: 'docType' },
        { title: this.translate.instant('document_status'), dataKey: 'docStatus' },
        { title: this.translate.instant('creation_date'), dataKey: 'createdAt' }
      ];

      const pdfTitle = this.translate.instant('financial_docs_menu_title') || this.translate.instant('financial_documents');

      const exportData = allFilteredDocs.map(doc => {
        // Translate doc type using uppercase key
        const rawDocType: string = doc.docType || '';
        let docTypeLabel: string = rawDocType;
        if (rawDocType) {
          const key = rawDocType.toUpperCase();
          const translated = this.translate.instant(key);
          docTypeLabel = translated && translated !== key ? translated : rawDocType;
        }

        // Translate doc status using uppercase key
        const rawDocStatus: string = doc.docStatus || '';
        let docStatusLabel: string = rawDocStatus;
        if (rawDocStatus) {
          const key = rawDocStatus.toUpperCase();
          const translated = this.translate.instant(key);
          docStatusLabel = translated && translated !== key ? translated : rawDocStatus;
        }

        const exportItem: any = {
          docNumber: doc.docNumber || 'N/A',
          docTitle: doc.docTitle || 'N/A',
          docType: docTypeLabel,
          docStatus: docStatusLabel,
          createdAt: doc.createdAt ? this.datePipe.transform(doc.createdAt, 'dd/MM/yyyy') : 'N/A'
        };
        return exportItem;
      });

      this.reportingService.exportPdf(exportColumns, exportData, 'financial-documents', pdfTitle);
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredDocs.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting financial documents PDF:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting PDF',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  async exportExcel() {
    if (this.isExporting) { return; }
    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_excel_please_wait') || 'Exporting Excel, please wait...',
        life: 3000
      });

      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      await firstValueFrom(this.translate.getTranslation(defaultLocale));

      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredDocs: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMorePages = true;
      const maxPages = 100;

      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === -1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };

      this.financialDocService.loadToken();

      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.financialDocService.getFinancialDocsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'createdAt',
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || [];
        allFilteredDocs = allFilteredDocs.concat(pageContent);

        const totalElements = response.page?.totalElements || response.totalElements || 0;
        hasMorePages = allFilteredDocs.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      if (allFilteredDocs.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('no_data_to_export') || 'No data available to export',
          life: 3000
        });
        this.isExporting = false;
        this.exportProgress = '';
        this.translate.use(currentLang);
        return;
      }

      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';

      const translatedDocs = allFilteredDocs.map(doc => {
        // Translate doc type using uppercase key
        const rawDocType: string = doc.docType || '';
        let docTypeLabel: string = rawDocType;
        if (rawDocType) {
          const key = rawDocType.toUpperCase();
          const translated = this.translate.instant(key);
          docTypeLabel = translated && translated !== key ? translated : rawDocType;
        }

        // Translate doc status using uppercase key
        const rawDocStatus: string = doc.docStatus || '';
        let docStatusLabel: string = rawDocStatus;
        if (rawDocStatus) {
          const key = rawDocStatus.toUpperCase();
          const translated = this.translate.instant(key);
          docStatusLabel = translated && translated !== key ? translated : rawDocStatus;
        }

        // Translate origin if present
        let originLabel: string = doc.origin || '';
        if (doc.origin) {
          const key = doc.origin.toLowerCase();
          const translated = this.translate.instant(key);
          originLabel = translated && translated !== key ? translated : doc.origin;
        }

        const translated: any = {
          [this.translate.instant('document_number')]: doc.docNumber || 'N/A',
          [this.translate.instant('document_title')]: doc.docTitle || 'N/A',
          [this.translate.instant('document_type')]: docTypeLabel,
          [this.translate.instant('document_status')]: docStatusLabel,
          [this.translate.instant('creation_date')]: doc.createdAt ? this.datePipe.transform(doc.createdAt, 'dd/MM/yyyy') : 'N/A'
        };

        if (doc.origin) {
          translated[this.translate.instant('origin')] = originLabel;
        }

        return translated;
      });

      this.reportingService.exportExcel(translatedDocs, 'financial-documents');
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredDocs.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting financial documents Excel:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting Excel',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }


  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  getOrderTotal(): number {
    return this.orderItems?.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) || 0;
  }

  getFinancialDocOrderTotal(): number {
    return this.financialDoc?.order?.orderItems?.reduce((sum, item) => 
      sum + (item.pricePerUnit * item.quantity), 0) || 0;
  }

  getEligibleOrdersForDocType(docType: DocumentType) {
    // Reset when doc type changes
    this.orderSuggestions = [];
    this.financialDoc.order = null;
    // Trigger initial load for autocomplete (when minLength is 0)
    // Defer to avoid change detection error
    setTimeout(() => {
      if (this.financialDoc.docType) {
        this.filterOrders({ query: '' });
      }
    }, 100);
  }

  /**
   * Filter orders for autocomplete
   */
  filterOrders(event: any): void {
    if (!this.financialDoc.docType) {
      this.orderSuggestions = [];
      return;
    }

    const query = (event?.query || '').trim();
    const requestToken = ++this.latestOrderSuggestionToken;

    // Defer loading state change to avoid change detection error
    Promise.resolve().then(() => {
      this.orderSuggestionsLoading = true;
    });

    // Call the paginated endpoint with search
    this.orderService.getEligibleOrdersForDocsByTypePaginated(
      this.financialDoc.docType!,
      0, // page
      20, // size
      'orderDate', // sortBy
      'DESC', // direction
      query || null // search
    ).subscribe({
      next: (response: any) => {
        // Check if this is still the latest request
        if (requestToken !== this.latestOrderSuggestionToken) {
          return;
        }

        if (response && response.content) {
          this.orderSuggestions = response.content;
        } else {
          this.orderSuggestions = Array.isArray(response) ? response : [];
        }
        
        // Defer loading state change to avoid change detection error
        Promise.resolve().then(() => {
          this.orderSuggestionsLoading = false;
        });
      },
      error: (error: any) => {
        console.error('Error while searching orders for autocomplete:', error);
        
        // Check if this is still the latest request
        if (requestToken !== this.latestOrderSuggestionToken) {
          return;
        }

        this.orderSuggestions = [];
        // Defer loading state change to avoid change detection error
        Promise.resolve().then(() => {
          this.orderSuggestionsLoading = false;
        });
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_fetching_orders'),
          life: 3000
        });
      }
    });
  }

  /**
   * Get display text for order in autocomplete
   */
  getOrderDisplayName(order: Order): string {
    if (!order) return '';
    return `#${order.reference} - ${this.currency} ${order.totalAmount?.toFixed(2) || '0.00'}`;
  }

  onDocumentDateChange() {
    // When document date changes, recalculate due date and validity if needed
    this.calculateDueDate();
    this.calculateValidityEndDate();
    // Refresh preview with new dates (debounced)
    this.triggerPreviewUpdate();
  }

  calculateDueDate() {
    if (this.financialDoc.paymentTermsDays && this.financialDoc.documentDate) {
      const docDate = this.financialDoc.documentDate instanceof Date 
        ? this.financialDoc.documentDate 
        : new Date(this.financialDoc.documentDate);
      const dueDate = new Date(docDate);
      dueDate.setDate(dueDate.getDate() + this.financialDoc.paymentTermsDays);
      this.financialDoc.dueDate = dueDate;
    }
    // Refresh preview with new due date (debounced)
    this.triggerPreviewUpdate();
  }

  onDueDateChange() {
    // When due date is manually changed, calculate payment terms days
    if (this.financialDoc.dueDate && this.financialDoc.documentDate) {
      const docDate = this.financialDoc.documentDate instanceof Date 
        ? this.financialDoc.documentDate 
        : new Date(this.financialDoc.documentDate);
      const dueDate = this.financialDoc.dueDate instanceof Date 
        ? this.financialDoc.dueDate 
        : new Date(this.financialDoc.dueDate);
      const diffTime = dueDate.getTime() - docDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        this.financialDoc.paymentTermsDays = diffDays;
      }
    }
    // Refresh preview with new due date (debounced)
    this.triggerPreviewUpdate();
  }

  getCalculatedDueDate(): Date | null {
    if (this.financialDoc.paymentTermsDays && this.financialDoc.documentDate) {
      const docDate = this.financialDoc.documentDate instanceof Date 
        ? this.financialDoc.documentDate 
        : new Date(this.financialDoc.documentDate);
      const dueDate = new Date(docDate);
      dueDate.setDate(dueDate.getDate() + this.financialDoc.paymentTermsDays);
      return dueDate;
    }
    return null;
  }

  calculateValidityEndDate() {
    if (this.financialDoc.validityDays && this.financialDoc.documentDate) {
      const docDate = this.financialDoc.documentDate instanceof Date 
        ? this.financialDoc.documentDate 
        : new Date(this.financialDoc.documentDate);
      const endDate = new Date(docDate);
      endDate.setDate(endDate.getDate() + this.financialDoc.validityDays);
      this.financialDoc.validityEndDate = endDate;
      
      // Set start date to document date if not set
      if (!this.financialDoc.validityStartDate) {
        this.financialDoc.validityStartDate = docDate;
      }
    }
    // Refresh preview with new validity dates (debounced)
    this.triggerPreviewUpdate();
  }

  getCalculatedValidityEndDate(): Date | null {
    if (this.financialDoc.validityDays && this.financialDoc.documentDate) {
      const docDate = this.financialDoc.documentDate instanceof Date 
        ? this.financialDoc.documentDate 
        : new Date(this.financialDoc.documentDate);
      const endDate = new Date(docDate);
      endDate.setDate(endDate.getDate() + this.financialDoc.validityDays);
      return endDate;
    }
    return null;
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

  getDocTypeLabel(docType: string | undefined): string {
    if (!docType) return 'N/A';
    const docTypeObj = this.docTypes?.find((dt: any) => dt.value === docType);
    return docTypeObj?.label || docType;
  }

  getDocTypeSeverity(docType: string | undefined): string {
    if (!docType) return 'secondary';
    switch (docType.toUpperCase()) {
      case 'INVOICE':
        return 'info';
      case 'PROFORMA_INVOICE':
        return 'warning';
      case 'QUOTE':
        return 'success';
      case 'CREDIT_NOTE':
        return 'danger';
      default:
        return 'secondary';
    }
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


  refreshPreview(): void {
    this.loadDocumentPreview();
  }

  previewPDF(): void {
    if (this.financialDoc?.docNumber) {
      this.financialDocService.printFinancialDoc(this.financialDoc.docNumber);
    }
  }

  /**
   * Load document preview from backend using templates
   */
  loadDocumentPreview(): void {
    // Don't load preview if we don't have an order
    if (!this.financialDoc?.order?.orderId) {
      this.previewHtml = '';
      this.safePreviewHtml = null;
      this.previewIframeSrc = null;
      this.previewError = null;
      return;
    }

    // Trigger preview update through the debounced subject
    this.triggerPreviewUpdate();
  }

  /**
   * Process preview HTML to extract styles and body content
   * Extracts styles from <head> and injects them into document head
   * Returns only the body content for display
   */
  private processPreviewHtml(html: string): string {
    if (!html) return html;
    
    const apiBaseUrl = this.getApiBaseUrl();
    
    // Parse the HTML to extract styles and body content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Process image URLs in the full HTML
    let processedHtml = html;
    
    // Handle relative logo paths: /api/organization/uploads/logos/logo.png
    processedHtml = processedHtml.replace(
      /src="(\/api\/organization\/uploads\/logos\/[^"]+)"/g,
      `src="${apiBaseUrl}$1"`
    );
    
    // Handle file:// URIs (fallback - should not occur with updated backend)
    processedHtml = processedHtml.replace(
      /src="file:\/\/[^"]*\/uploads\/logos\/([^"]+)"/g,
      (match, filename) => {
        return `src="${apiBaseUrl}/api/organization/uploads/logos/${filename}"`;
      }
    );
    
    // Handle file:// URIs from backend templates (file:///src/main/resources/public/...)
    processedHtml = processedHtml.replace(
      /src="file:\/\/\/src\/main\/resources\/public\/(uploads\/[^"'\s]+)"/g,
      (match, filePath) => {
        // Convert to organization uploads endpoint
        const logoMatch = filePath.match(/uploads\/logos\/(.+)/);
        if (logoMatch) {
          return `src="${apiBaseUrl}/api/organization/uploads/logos/${logoMatch[1]}"`;
        }
        return `src="${apiBaseUrl}/api/files/${filePath}"`;
      }
    );
    
    // Handle any other file:// URIs (replace with empty or placeholder)
    processedHtml = processedHtml.replace(/src="file:\/\/[^"]*"/g, 'src=""');
    
    // Create a data URL for the iframe
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(processedHtml);
    this.previewIframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(dataUrl);
    
    // Also keep the body content for fallback if needed
    const bodyContent = doc.body.innerHTML || '';
    return bodyContent;
  }



  /**
   * Format date to YYYY-MM-DD using local timezone (not UTC)
   * This prevents timezone conversion issues that cause dates to shift by -1 day
   */
  private formatDateLocal(date: Date | string): string {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Use local timezone methods to avoid UTC conversion issues
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Get API base URL for constructing absolute URLs
   */
  private getApiBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}`;
  }

  /**
   * Handle preview errors with user-friendly messages
   */
  private handlePreviewError(error: any): void {
    console.error('Error loading document preview:', error);
    
    if (error.status === 400) {
      this.previewError = error.error?.message || this.translate.instant('error_loading_preview') || 'Invalid request data';
    } else if (error.status === 404) {
      this.previewError = this.translate.instant('order_not_found') || 'Order or return not found';
    } else if (error.status === 401) {
      this.previewError = this.translate.instant('authentication_required') || 'Authentication required';
    } else if (error.status === 500) {
      this.previewError = this.translate.instant('server_error') || 'Server error. Please try again later.';
    } else {
      this.previewError = this.translate.instant('error_loading_preview') || 'Failed to load preview';
    }
    
    // Fallback to empty preview
    this.previewHtml = '';
    this.safePreviewHtml = null;
    this.previewIframeSrc = null;
  }

  /**
   * Trigger preview update with debounce
   * Call this method when form fields change
   */
  triggerPreviewUpdate(): void {
    if (this.financialDoc?.order?.orderId) {
      // Prepare preview data
      const previewData: any = {
        docType: this.financialDoc.docType,
        orderId: this.financialDoc.order.orderId,
        documentDate: this.financialDoc.documentDate ? (this.financialDoc.documentDate instanceof Date 
          ? this.formatDateLocal(this.financialDoc.documentDate) 
          : this.financialDoc.documentDate) : undefined,
        dueDate: this.financialDoc.dueDate ? (this.financialDoc.dueDate instanceof Date 
          ? this.formatDateLocal(this.financialDoc.dueDate) 
          : this.financialDoc.dueDate) : undefined,
        deliveryDate: this.financialDoc.deliveryDate ? (this.financialDoc.deliveryDate instanceof Date 
          ? this.formatDateLocal(this.financialDoc.deliveryDate) 
          : this.financialDoc.deliveryDate) : undefined,
        validityStartDate: this.financialDoc.validityStartDate ? (this.financialDoc.validityStartDate instanceof Date 
          ? this.formatDateLocal(this.financialDoc.validityStartDate) 
          : this.financialDoc.validityStartDate) : undefined,
        validityEndDate: this.financialDoc.validityEndDate ? (this.financialDoc.validityEndDate instanceof Date 
          ? this.formatDateLocal(this.financialDoc.validityEndDate) 
          : this.financialDoc.validityEndDate) : undefined,
        paymentTermsDays: this.financialDoc.paymentTermsDays,
        paymentTerms: this.financialDoc.paymentTerms,
        notes: this.financialDoc.notes,
        requiresSignature: this.financialDoc.requiresSignature,
        additionalReferences: this.financialDoc.additionalReferences
      };

      // Remove undefined values
      Object.keys(previewData).forEach(key => {
        if (previewData[key] === undefined) {
          delete previewData[key];
        }
      });

      this.previewUpdateSubject.next(previewData);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
