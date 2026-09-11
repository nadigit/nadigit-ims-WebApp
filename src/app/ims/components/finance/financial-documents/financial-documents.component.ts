import { Component, OnInit, ViewChild, OnDestroy, SecurityContext, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { MessageService, LazyLoadEvent } from 'primeng/api';
import { Table } from 'primeng/table';
import { firstValueFrom, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, catchError } from 'rxjs/operators';
import { DocumentType, FinancialDocument } from 'src/app/models/financialDocument';
import { Order } from 'src/app/models/order';
import { OrderReturn } from 'src/app/models/orderReturn';
import { Organization } from 'src/app/models/organization';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { OrderService } from 'src/app/services/order.service';
import { ReturnService } from 'src/app/services/return.service';
import { OrganizationService } from 'src/app/services/organization.service';
import { PermissionService } from 'src/app/services/permission.service';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { DatePipe } from '@angular/common';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import {
  initTablePageSizeState,
  persistTablePageSizeFromLazyEvent,
  TablePageSizeKeys,
} from 'src/app/utils/table-page-size.storage';

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
  pageSize = 20;

  exportColumns!: ExportColumn[];

  orders: Order[] = [];
  orderSuggestions: Order[] = []; // For autocomplete suggestions
  totalOrders: number = 0; // Total orders for lazy loading
  orderSuggestionsLoading: boolean = false;
  latestOrderSuggestionToken: number = 0;

  orderReturns: OrderReturn[] = [];
  orderReturnsLoading: boolean = false;
  selectedOrderReturn: OrderReturn | null = null;

  docTypeSequences: { [key: string]: number } = {};


  // Permissions
  canAddFinancialDocs: boolean = false;
  canEditFinancialDocs: boolean = false;
  canDeleteFinancialDocs: boolean = false;
  canReadFinancialDocs: boolean = false;
  canIssueFinancialDocs: boolean = false;
  isFinancialDocumentsFeatureEnabled: boolean = true;
  isAdmin: boolean = false;
  isLoading = true;
  isInitialLoad = true;
  private lazyLoadCallCount = 0;
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
  tableSortField: string = 'createdAt';
  tableSortOrder: number = -1; // PrimeNG: -1 = DESC, 1 = ASC
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
  private searchChange$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  private previewStyleId: string = 'financial-doc-preview-styles';
  
  // API configuration for file URLs
  apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  apiHost: string = (window as any).__env?.apiHost || 'localhost';
  apiPort: string = (window as any).__env?.apiPort || '8090';


  constructor(private messageService: MessageService,
    private financialDocService: FinancialDocumentsService,
    private orderService: OrderService,
    private returnService: ReturnService,
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
    private datePipe: DatePipe,
    private licenseCapabilitiesService: LicenseCapabilitiesService) {
    this.setUserRoles()
    this.loadOrganization();
  }

  async ngOnInit() {
    this.isLoading = true;
    initTablePageSizeState(TablePageSizeKeys.financialDocuments, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
      lastLazyLoadEvent: this.lastLazyLoadEvent,
    });
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
    await this.loadLicenseCapabilities();
    
    this.cols = [
      { field: 'docNumber', header: this.translateService.instant('document_number') },
      { field: 'docTitle', header: this.translateService.instant('document_title') },
      { field: 'docType', header: this.translateService.instant('document_type') },
      { field: 'docStatus', header: this.translateService.instant('document_status') },
      { field: 'createdAt', header: this.translateService.instant('creation_date') },
      { field: 'issuedAt', header: this.translateService.instant('issued_date') },
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

    // Debounce the global search so typing does not fire one server-side
    // query (five LIKE predicates) per keystroke.
    this.searchChange$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((value: string) => {
        // Drop emissions already reflected in the table (e.g. a keystroke still
        // in flight when the user hit "clear filters").
        if (value === (this.lastLazyLoadEvent.globalFilter ?? '')) {
          return;
        }
        this.globalFilter = value;
        this.lastLazyLoadEvent.first = 0;
        this.lastLazyLoadEvent.globalFilter = value;
        this.loadFinancialDocs();
      });

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

    this.loadFinancialDocs();
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
    this.resetReturnSelectionState();
    if (this.isReturnLinkedDocumentType(this.financialDoc.docType) && this.financialDoc?.order?.orderId) {
      void this.loadReturnsForSelectedOrder(this.financialDoc.order.orderId);
    }
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
    this.resetReturnSelectionState();

    this.issueFinancialDocDialog = true;
    this.financialDoc = { ...financialDoc };
    this.normalizeFinancialDocDates();

    if (financialDoc.financialDocId) {
      void this.hydrateFinancialDocForIssue(financialDoc.financialDocId);
    }
  }

  private async hydrateFinancialDocForIssue(financialDocId: number): Promise<void> {
    try {
      const fullDoc = await firstValueFrom(this.financialDocService.getFinancialDoc(financialDocId));
      this.financialDoc = { ...this.financialDoc, ...fullDoc };
      this.normalizeFinancialDocDates();
      if (this.isReturnLinkedDocumentType(this.financialDoc.docType) && this.financialDoc?.order?.orderId) {
        await this.loadReturnsForSelectedOrder(this.financialDoc.order.orderId);
      }
      if (this.issueFinancialDocDialog) {
        this.loadDocumentPreview();
      }
    } catch (error) {
      console.error('Error loading financial document details:', error);
      if (this.issueFinancialDocDialog) {
        this.loadDocumentPreview();
      }
    }
  }

  private normalizeFinancialDocDates(): void {
    if (!this.financialDoc.documentDate) {
      this.financialDoc.documentDate = new Date();
    } else if (typeof this.financialDoc.documentDate === 'string') {
      this.financialDoc.documentDate = new Date(this.financialDoc.documentDate);
    }

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
  }

  onIssueDialogShow() {
    // Preview for existing drafts is loaded after hydrateFinancialDocForIssue completes
    setTimeout(() => {
      this.previewError = null;
      this.previewLoading = false;
      if (!this.financialDoc.financialDocId) {
        this.loadDocumentPreview();
      }
    }, 100);
  }

  cancelFinancialDoc(financialDoc: FinancialDocument) {
    if (!this.canEditFinancialDocs) return;
    this.cancelFinancialDocDialog = true;
    this.financialDoc = { ...financialDoc };
  }

  confirmIssueDocument() {
    if (this.isReturnLinkedDocumentType(this.financialDoc.docType) && !this.financialDoc.returnId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('order_return_is_required'),
        life: 3000
      });
      return;
    }

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
    if (!this.isFinancialDocumentsFeatureEnabled) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Upgrade required',
        detail: 'Financial documents are not available on your current plan. Upgrade to continue.',
        life: 7000
      });
      return;
    }
    this.financialDoc = {};
    this.resetReturnSelectionState();
    this.submitted = false;
    this.draftFinancialDocDialog = true;
  }

  onDocTypeChange(selectedType: DocumentType) {
    if (!selectedType) {
      this.orders = [];
      this.financialDoc.order = null;
      this.financialDoc.docTitle = '';
      this.clearReturnSelection();
      return;
    }

    if (!this.isReturnLinkedDocumentType(selectedType)) {
      this.clearReturnSelection();
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

    if (this.isReturnLinkedDocumentType(this.financialDoc.docType) && !this.financialDoc.returnId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('order_return_is_required'),
        life: 3000
      });
      return;
    }

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
    if (this.isLoading) {
      return;
    }
    this.lazyLoadCallCount++;
    if (this.lazyLoadCallCount === 1 && this.financialDocs.length > 0) {
      this.isInitialLoad = false;
      return;
    }
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.isInitialLoad = false;
    this.isLoading = true;
    this.cdr.markForCheck();
    this.loadFinancialDocs();
  }

  updateLastLazyLoadEvent(event: LazyLoadEventExt) {
    persistTablePageSizeFromLazyEvent(TablePageSizeKeys.financialDocuments, this.rowsPerPageOptions, event, {
      pageSize: this.pageSize,
    });
    const rows = event.rows || this.lastLazyLoadEvent.rows || this.pageSize;
    const sortField = this.resolveSortField(event.sortField);
    const sortOrder = event.sortOrder === 1 || event.sortOrder === -1 ? event.sortOrder : -1;

    this.tableSortField = sortField;
    this.tableSortOrder = sortOrder;
    this.lastLazyLoadEvent = {
      first: event.first ?? 0,
      rows,
      sortField,
      sortOrder,
      // `globalFilter` is two-way bound to the search input, so it is always the
      // source of truth; a stale value carried on the event must never win.
      globalFilter: this.globalFilter,
      filters: event.filters || this.lastLazyLoadEvent.filters || {}
    };
  }

  /** PrimeNG lazy table: 1 = ascending, -1 = descending. */
  private resolveSortDirection(sortOrder?: number | null): 'ASC' | 'DESC' {
    return sortOrder === 1 ? 'ASC' : 'DESC';
  }

  private resolveSortField(sortField?: string | string[] | null): string {
    if (Array.isArray(sortField)) {
      return sortField[0] || 'createdAt';
    }
    return sortField || 'createdAt';
  }

  onGlobalFilter(event: Event) {
    this.searchChange$.next((event.target as HTMLInputElement).value);
  }

  onFilterChange() {
    if (this.isInitialLoad) {
      return;
    }
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
    // Supersede any debounced keystroke still pending so it cannot re-apply
    // the old search term after this reset.
    this.searchChange$.next('');
    
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

    const page = Math.floor((first ?? 0) / (rows || 20));
    const size = rows || 20;
    const direction = this.resolveSortDirection(sortOrder);
    this.isLoading = true;
    
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
        this.isInitialLoad = false;
        
        // Trigger change detection to ensure table updates
        if (this.cdr) {
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => {
        console.error(err);
        this.financialDocs = [];
        this.isLoading = false;
        this.isInitialLoad = false;
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
      const direction = this.resolveSortDirection(sortOrder);
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

      this.reportingService.exportPdf(exportColumns, exportData, 'financial-documents', pdfTitle, organization?.organizationName);
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
      const direction = this.resolveSortDirection(sortOrder);
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

      this.reportingService.exportExcel(translatedDocs, 'financial-documents', {
        title: this.translate.instant('financial_docs_menu_title'),
        organizationName: organization?.organizationName,
        generatedLabel: this.translate.instant('export_generated_on'),
        generatedAt: new Date().toLocaleString(defaultLocale),
      });
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

  getEligibleOrdersForDocType(docType: DocumentType | string) {
    const docTypeValue = docType ? String(docType) : this.financialDoc.docType;
    if (docTypeValue) {
      this.financialDoc.docType = docTypeValue;
    }

    this.orderSuggestions = [];
    this.financialDoc.order = null;

    if (!docTypeValue) {
      return;
    }

    setTimeout(() => this.filterOrders({ query: '' }, docTypeValue), 0);
  }

  private normalizeEligibleOrdersResponse(response: any): Order[] {
    if (!response) {
      return [];
    }
    if (Array.isArray(response)) {
      return response;
    }
    if (Array.isArray(response.content)) {
      return response.content;
    }
    if (Array.isArray(response.page?.content)) {
      return response.page.content;
    }
    return [];
  }

  /**
   * Filter orders for autocomplete
   */
  filterOrders(event: any, docTypeOverride?: string): void {
    const docType = docTypeOverride || this.financialDoc.docType;
    if (!docType) {
      this.orderSuggestions = [];
      return;
    }

    const query = (event?.query || '').trim();
    const requestToken = ++this.latestOrderSuggestionToken;

    Promise.resolve().then(() => {
      this.orderSuggestionsLoading = true;
      this.cdr.markForCheck();
    });

    this.orderService.getEligibleOrdersForDocsByTypePaginated(
      docType,
      0,
      20,
      'orderDate',
      'DESC',
      query || null
    ).subscribe({
      next: (response: any) => {
        if (requestToken !== this.latestOrderSuggestionToken) {
          return;
        }

        this.orderSuggestions = this.normalizeEligibleOrdersResponse(response);

        Promise.resolve().then(() => {
          this.orderSuggestionsLoading = false;
          this.cdr.markForCheck();
        });
      },
      error: (error: any) => {
        console.error('Error while searching orders for autocomplete:', error);
        
        // Check if this is still the latest request
        if (requestToken !== this.latestOrderSuggestionToken) {
          return;
        }

        this.orderSuggestions = [];
        Promise.resolve().then(() => {
          this.orderSuggestionsLoading = false;
          this.cdr.markForCheck();
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

  onOrderSelected(event: any): void {
    const selected = event?.value as Order | undefined;
    if (selected && selected.orderId) {
      this.financialDoc.order = selected;
      this.clearReturnSelection();
      if (this.isReturnLinkedDocumentType(this.financialDoc.docType)) {
        void this.loadReturnsForSelectedOrder(selected.orderId);
      }
      this.triggerPreviewUpdate();
    }
  }

  onOrderCleared(): void {
    this.financialDoc.order = null;
    this.orderSuggestions = [];
    this.resetReturnSelectionState();
    this.previewHtml = '';
    this.safePreviewHtml = null;
    this.previewIframeSrc = null;
    this.previewError = null;
  }

  /**
   * Keep autocomplete stable: allow free typing while searching, then
   * normalize the value on blur to a real Order object or clear it.
   */
  onOrderAutoCompleteBlur(): void {
    const currentValue: any = this.financialDoc?.order;
    if (!currentValue) {
      this.financialDoc.order = null;
      return;
    }

    if (typeof currentValue === 'object' && currentValue.orderId) {
      return;
    }

    const typed = String(currentValue).trim();
    if (!typed) {
      this.financialDoc.order = null;
      return;
    }

    const matched = this.orderSuggestions.find((o: any) => {
      const ref = String(o?.reference ?? '').trim().toLowerCase();
      return ref === typed.toLowerCase();
    });

    this.financialDoc.order = matched || null;
    if (!matched) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('select_order_option'),
        life: 2200
      });
    } else {
      this.triggerPreviewUpdate();
    }
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

    if (this.isReturnLinkedDocumentType(this.financialDoc.docType) && !this.financialDoc.returnId) {
      this.previewLoading = false;
      this.previewError = this.translate.instant('order_return_is_required');
      this.previewHtml = '';
      this.safePreviewHtml = null;
      this.previewIframeSrc = null;
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
    
    // Handle relative logo paths: /api/organizations/uploads/logos/logo.png
    processedHtml = processedHtml.replace(
      /src="(\/api\/organizations\/uploads\/logos\/[^"]+)"/g,
      `src="${apiBaseUrl}$1"`
    );

    // Backward compatibility for older preview HTML
    processedHtml = processedHtml.replace(
      /src="(\/api\/organization\/uploads\/logos\/[^"]+)"/g,
      (match, path) => `src="${apiBaseUrl}${path.replace('/api/organization/', '/api/organizations/')}"`
    );
    
    // Handle file:// URIs (fallback - should not occur with updated backend)
    processedHtml = processedHtml.replace(
      /src="file:\/\/[^"]*\/uploads\/logos\/([^"]+)"/g,
      (match, filename) => {
        return `src="${apiBaseUrl}/api/organizations/uploads/logos/${filename}"`;
      }
    );
    
    // Handle file:// URIs from backend templates (file:///src/main/resources/public/...)
    processedHtml = processedHtml.replace(
      /src="file:\/\/\/src\/main\/resources\/public\/(uploads\/[^"'\s]+)"/g,
      (match, filePath) => {
        // Convert to organization uploads endpoint
        const logoMatch = filePath.match(/uploads\/logos\/(.+)/);
        if (logoMatch) {
          return `src="${apiBaseUrl}/api/organizations/uploads/logos/${logoMatch[1]}"`;
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
      if (this.isReturnLinkedDocumentType(this.financialDoc.docType) && !this.financialDoc.returnId) {
        this.previewLoading = false;
        this.previewError = this.translate.instant('order_return_is_required');
        this.previewHtml = '';
        this.safePreviewHtml = null;
        this.previewIframeSrc = null;
        return;
      }

      // Prepare preview data
      const previewData: any = {
        docType: this.financialDoc.docType,
        orderId: this.financialDoc.order.orderId,
        returnId: this.financialDoc.returnId,
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

  isReturnLinkedDocumentType(docType?: string | DocumentType): boolean {
    const type = docType == null ? '' : String(docType);
    return type === 'RETURN_NOTE' || type === 'CREDIT_NOTE';
  }

  async loadReturnsForSelectedOrder(orderId?: number): Promise<void> {
    const id = orderId ?? this.financialDoc?.order?.orderId;
    if (!id) {
      this.orderReturns = [];
      this.selectedOrderReturn = null;
      return;
    }

    this.orderReturnsLoading = true;
    try {
      const returns = await firstValueFrom(this.returnService.getReturnsForOrder(id));
      this.orderReturns = Array.isArray(returns) ? returns : [];
      if (this.financialDoc.returnId) {
        this.selectedOrderReturn =
          this.orderReturns.find((r) => r.returnId === this.financialDoc.returnId) ?? null;
      } else if (this.orderReturns.length === 1) {
        this.onReturnSelected(this.orderReturns[0]);
      }
    } catch (error) {
      console.error('Error loading returns for order:', error);
      this.orderReturns = [];
      this.selectedOrderReturn = null;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_order_returns'),
        life: 3000
      });
    } finally {
      this.orderReturnsLoading = false;
    }
  }

  onReturnSelected(orderReturn: OrderReturn | null): void {
    this.selectedOrderReturn = orderReturn;
    this.financialDoc.returnId = orderReturn?.returnId;
    this.triggerPreviewUpdate();
  }

  onReturnCleared(): void {
    this.clearReturnSelection();
    this.triggerPreviewUpdate();
  }

  clearReturnSelection(): void {
    this.selectedOrderReturn = null;
    this.financialDoc.returnId = undefined;
  }

  resetReturnSelectionState(): void {
    this.orderReturns = [];
    this.orderReturnsLoading = false;
    this.selectedOrderReturn = null;
    this.financialDoc.returnId = undefined;
  }

  getReturnDisplayName(orderReturn: OrderReturn): string {
    if (!orderReturn) {
      return '';
    }
    const ref = orderReturn.reference || `#${orderReturn.returnId}`;
    const amount = orderReturn.totalRefundableAmount;
    if (amount != null) {
      return `${ref} — ${this.currency} ${Number(amount).toFixed(2)}`;
    }
    return ref;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadLicenseCapabilities(): Promise<void> {
    try {
      await this.licenseCapabilitiesService.ensureLoaded();
      this.isFinancialDocumentsFeatureEnabled = this.licenseCapabilitiesService.isFeatureEnabled('FINANCIAL_DOCUMENTS');
    } catch (error) {
      console.warn('Unable to resolve license capabilities for financial documents.', error);
      this.isFinancialDocumentsFeatureEnabled = true;
    }
  }

}
