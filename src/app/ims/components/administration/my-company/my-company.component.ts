import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { TreeNode } from 'primeng/api';
import { OrganizationService } from 'src/app/services/organization.service';
import { BrandingService } from 'src/app/services/branding.service';
import { Organization } from 'src/app/models/organization';
import { LocationService } from 'src/app/services/location.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { OrganizationContextService, OrganizationAccess } from 'src/app/services/organization-context.service';

@Component({
  templateUrl: './my-company.component.html',
  styleUrls: ['./my-company.component.css', '../administration.component.css'],
  providers: [MessageService]
})
export class MyCompanyComponent implements OnInit, OnDestroy {

  submitted: boolean = false;
  organizationDialog: boolean = false;
  organization: Organization = {}
  selectedNodes!: TreeNode[];
  organizationStructure: any;
  countries: any;
  selectedCountry: any = null;
  states: any = null;
  uploadedFile: File | null = null;
  isLoading: boolean = true;
  selectedLogo: File | null = null;
  selectedLogoUrl: string | null = null;
  logoImageUrl: string | undefined;
  imageLoading: boolean = true;
  imagePreviewUrl: string | null = null;
  isImageLoading: boolean = false;
  isDragOver: boolean = false;
  imageZoomDialog: boolean = false;
  recentProductImages: string[] = [];
  isSaving: boolean = false;
  uploadProgress: number = 0;
  existingImageFile: any = null;
  availableLocales: any[] = [];
  costingMethods: any[] = [];
  activityProfileLabelKey = 'business_activity_profile_not_set';
  private activityProfileSub?: Subscription;

  // Multi-organization (ENTERPRISE) management — hidden on every other tier.
  multiOrgEnabled: boolean = false;
  organizations: OrganizationAccess[] = [];
  activeOrganizationId: number | null = null;
  isNewOrganization: boolean = false;

  membersDialog: boolean = false;
  membershipOrg: OrganizationAccess | null = null;
  members: any[] = [];
  keycloakUsers: any[] = [];
  selectedUsername: string | null = null;
  makeDefaultMembership: boolean = false;
  membersLoading: boolean = false;

  constructor(
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private organizationService: OrganizationService,
    private translate: TranslateService,
    private locationService: LocationService,
    private translateService: TranslationService,
    public activityProfileService: ActivityProfileService,
    private licenseCapabilities: LicenseCapabilitiesService,
    private authenticationService: AuthenticationService,
    private organizationContext: OrganizationContextService,
    private brandingService: BrandingService,
  ) { }

  ngOnDestroy(): void {
    this.activityProfileSub?.unsubscribe();
  }

  async ngOnInit() {
    this.isLoading = true;
    this.imageLoading = true;
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();
    });

    this.loadOrganization();

    try {
      await this.activityProfileService.ensureLoaded();
      this.syncActivityProfileLabel();
      this.activityProfileSub = this.activityProfileService.contextChanged$.subscribe(() => this.syncActivityProfileLabel());
    } catch {
      this.activityProfileLabelKey = 'business_activity_profile_not_set';
    }

    this.costingMethods = [
      { label: this.translate.instant('costing_method_fifo'), value: 'FIFO' },
      { label: this.translate.instant('costing_method_lifo'), value: 'LIFO' },
      { label: this.translate.instant('costing_method_weighted_average'), value: 'WEIGHTED_AVERAGE' },
      { label: this.translate.instant('costing_method_standard_cost'), value: 'STANDARD_COST' },
      { label: this.translate.instant('costing_method_none'), value: 'NONE' }
    ];

    this.availableLocales = [
      { label: 'English', value: 'en' },
      { label: 'الْعَرَبِيَّةُ', value: 'ar' },
      { label: 'Français', value: 'fr' },
      { label: 'Español', value: 'es' }
    ];

    this.initMultiOrganization();
  }

  /**
   * On ENTERPRISE (MULTI_ORGANIZATION) deployments, load the list of organizations so the admin can
   * create additional companies and manage who can access each. Inert on every other tier.
   */
  private async initMultiOrganization(): Promise<void> {
    try {
      await this.licenseCapabilities.ensureLoaded();
      this.multiOrgEnabled = this.licenseCapabilities.isFeatureEnabled('MULTI_ORGANIZATION');
      if (!this.multiOrgEnabled) {
        return;
      }
      this.activeOrganizationId = this.organizationContext.getActiveOrganizationId();
      await this.reloadOrganizationsList();
    } catch {
      this.multiOrgEnabled = false;
    }
  }

  private async reloadOrganizationsList(): Promise<void> {
    try {
      this.organizations = (await firstValueFrom(this.organizationService.getMyOrganizations())) || [];
    } catch {
      this.organizations = [];
    }
  }

  /** Open the shared org dialog with a blank organization to create an additional company. */
  openNewOrganization(): void {
    this.organization = { defaultLocale: 'en' };
    this.selectedCountry = null;
    this.states = null;
    this.isNewOrganization = true;
    this.submitted = false;
    this.clearImage();
    this.organizationDialog = true;
  }

  switchToOrganization(org: OrganizationAccess): void {
    this.organizationContext.setActive(org.organizationId);
  }

  async openMembersDialog(org: OrganizationAccess): Promise<void> {
    this.membershipOrg = org;
    this.selectedUsername = null;
    this.makeDefaultMembership = false;
    this.membersDialog = true;
    this.membersLoading = true;
    try {
      if (this.keycloakUsers.length === 0) {
        this.keycloakUsers = (await firstValueFrom(this.authenticationService.getUsers() as any)) || [];
      }
      await this.loadMembers(org.organizationId);
    } catch (e) {
      console.error('Error loading organization members:', e);
      this.messageService.add({
        severity: 'error', summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_organization_members'), life: 3000
      });
    } finally {
      this.membersLoading = false;
    }
  }

  private async loadMembers(organizationId: number): Promise<void> {
    this.members = (await firstValueFrom(this.organizationService.listMembers(organizationId))) || [];
  }

  async grantAccess(): Promise<void> {
    if (!this.membershipOrg || !this.selectedUsername) {
      return;
    }
    try {
      await firstValueFrom(this.organizationService.grantMembership(
        this.selectedUsername, this.membershipOrg.organizationId, this.makeDefaultMembership));
      this.messageService.add({
        severity: 'success', summary: this.translate.instant('successful'),
        detail: this.translate.instant('organization_access_granted'), life: 3000
      });
      this.selectedUsername = null;
      this.makeDefaultMembership = false;
      await this.loadMembers(this.membershipOrg.organizationId);
    } catch (e) {
      console.error('Error granting organization access:', e);
      this.messageService.add({
        severity: 'error', summary: this.translate.instant('error'),
        detail: this.translate.instant('error_granting_organization_access'), life: 3000
      });
    }
  }

  async revokeAccess(username: string): Promise<void> {
    if (!this.membershipOrg) {
      return;
    }
    try {
      await firstValueFrom(this.organizationService.revokeMembership(username, this.membershipOrg.organizationId));
      this.messageService.add({
        severity: 'success', summary: this.translate.instant('successful'),
        detail: this.translate.instant('organization_access_revoked'), life: 3000
      });
      await this.loadMembers(this.membershipOrg.organizationId);
    } catch (e) {
      console.error('Error revoking organization access:', e);
      this.messageService.add({
        severity: 'error', summary: this.translate.instant('error'),
        detail: this.translate.instant('error_revoking_organization_access'), life: 3000
      });
    }
  }

  /** Users not already members, for the grant dropdown. */
  get grantableUsers(): any[] {
    const existing = new Set(this.members.map(m => (m.username || '').toLowerCase()));
    return (this.keycloakUsers || []).filter(u => u.username && !existing.has(String(u.username).toLowerCase()));
  }

  private syncActivityProfileLabel(): void {
    this.activityProfileLabelKey = this.activityProfileService.profileLabelI18nKey();
  }

  async loadOrganization(): Promise<void> {
    this.isLoading = true;

    try {
      // Load translations first
      const translations = await firstValueFrom(
        this.translate.get(['shops_menu_title', 'warehouses_menu_title'])
      );

      // Load organization data
      const data = await firstValueFrom(this.organizationService.getOrganization());
      this.organization = data;
      console.log(this.organization);

      // Build organization structure
      this.organizationStructure = [
        {
          expanded: true,
          type: 'organization',
          data: {
            name: this.organization.organizationName,
            title: 'Organization'
          },
          children: [
            {
              expanded: true,
              type: 'shops',
              data: { name: translations['shops_menu_title'] },
              children: (this.organization.shops || []).map(shop => ({
                type: 'shop',
                data: { name: shop.shopName, shopId: shop.shopId }
              }))
            },
            {
              expanded: true,
              type: 'warehouses',
              data: { name: translations['warehouses_menu_title'] },
              children: (this.organization.warehouses || []).map(warehouse => ({
                type: 'warehouse',
                data: { name: warehouse.name, warehouseId: warehouse.warehouseId }
              }))
            }
          ]
        }
      ];

      // Now that we have the organization, get the logo
      await this.getLogoImage(this.organization.logo);

    } catch (error) {
      console.error('Error loading translations or organization data:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_organization_data'),
        life: 3000
      });
    } finally {
      this.isLoading = false;
    }
  }

  goBack(): void {
    this.location.back();
  }

  async openOrganizationDialog(event: any): Promise<void> {
    if (event.node.data.title === 'Organization') {
      this.submitted = false;
      this.isNewOrganization = false;
  
      // preload states from existing country
      if (this.organization.country) {
        this.loadStatesForCountry(this.organization.country);
      }
  
      this.organizationDialog = true;
  
      console.log(this.organization);
    }
  }

  loadStatesForCountry(countryName: string): void {
    const country = this.countries.find(c => c.name === countryName);
  
    if (country) {
      this.selectedCountry = country;
      this.states = this.locationService.getStatesByCountryCode(country.isoCode);
    }
  }

  hideDialog() {
    this.organizationDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  async saveOrganization() {
    this.submitted = true;

    if (!this.organization.organizationName?.trim() || !this.organization.defaultLocale) {
      return;
    }

    // If the uploadedFile is set, proceed with uploading to the backend
    if (this.uploadedFile) {
        try {
          const uploadResponseString = await this.organizationService.uploadLogo(this.uploadedFile).toPromise();

          // Parse the response if it's a string
          let uploadResponse;
          if (typeof uploadResponseString === 'string') {
            uploadResponse = JSON.parse(uploadResponseString);
          } else {
            uploadResponse = uploadResponseString; // Already an object
          }

          if (uploadResponse && uploadResponse.logoUrl) {
            this.organization.logo = uploadResponse.logoUrl; // Set logo URL
            this.logoImageUrl = uploadResponse.logoUrl;
            this.imagePreviewUrl = uploadResponse.logoUrl;
            // Push the new logo to everything else showing it (top bar) without a page reload.
            void this.brandingService.refresh();
          } else {
          }
        } catch (error: any) {
          console.error('Error uploading file:', error);
          // The server rejects oversized / mistyped / scriptable images with a specific, already
          // localized reason — show that rather than a generic failure the admin can't act on.
          let detail = this.translate.instant('error_while_uploading_logo');
          const serverMessage = error?.error?.message;
          if (typeof serverMessage === 'string' && serverMessage.trim()) {
            detail = serverMessage;
          } else if (typeof error?.error === 'string' && error.error.trim()) {
            // uploadLogo() requests responseType 'text', so an error body may arrive as a raw string.
            try {
              detail = JSON.parse(error.error)?.message || detail;
            } catch {
              detail = error.error;
            }
          }
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail,
            life: 6000
          });
          return; // Exit if there's an error
        }
    }

    try {
      if (this.organization.organizationId) {
        await this.organizationService.updateOrganization(this.organization.organizationId, this.organization).toPromise();
      } else {
        await this.organizationService.saveOrganization(this.organization).toPromise();
      }
      this.submitted = false;
      this.organizationDialog = false;
      const wasNew = this.isNewOrganization;
      this.isNewOrganization = false;
      if (wasNew && this.multiOrgEnabled) {
        // A newly created company won't be the active one yet; refresh the list and keep showing
        // the current org. The admin can switch to the new company from here or the topbar.
        await this.reloadOrganizationsList();
        this.messageService.add({
          severity: 'success', summary: this.translate.instant('successful'),
          detail: this.translate.instant('organization_added'), life: 3000
        });
      }
      this.loadOrganization();
    } catch (error) {
      console.error('Error while saving organization:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_saving_organization'),
        life: 3000
      });
    }
  }

  getLogoImage(path: string | null | undefined) {
    this.imageLoading = true;
    console.log("path: " + path)
    
    // If logo path is null, undefined, or empty, this is expected behavior - no error
    if (!path || path === null || path === undefined || path.trim() === '') {
      this.logoImageUrl = undefined; // Will show placeholder image
      this.imageLoading = false;
      return;
    }
    
    // Fetch the logo image using the organizationService
    this.organizationService.getLogoImage(path).subscribe(blob => {
      // Create a URL for the blob response
      const url = URL.createObjectURL(blob);
      this.logoImageUrl = url; // Store the URL for displaying the image
      console.log(this.logoImageUrl)
      this.imageLoading = false;
    }, error => {
      console.error('Error fetching logo image:', error);
      this.imageLoading = false;
      // Only show error if we actually tried to fetch a logo (path exists)
      // This prevents showing errors when logo is null (expected behavior)
      if (path && path.trim() !== '') {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_fetching_logo_image'),
          life: 3000
        });
      } else {
        // Logo is null/empty, just set to undefined to show placeholder
        this.logoImageUrl = undefined;
      }
    });
  }

  onChangeCountry() {
    this.organization.city = undefined;
  }

  onSelectedCountry(event: any): void {

    // Country cleared
    if (!event.value) {
      this.organization.country = undefined;
      this.organization.city = undefined;
      this.selectedCountry = undefined;
      this.states = [];
      return;
    }
  
    const country = this.countries.find(
      c => c.name === event.value
    );
  
    if (!country) {
      this.states = [];
      this.organization.city = undefined;
      return;
    }
  
    // Clear city only if country changed
    if (this.organization.country !== country.name) {
      this.organization.city = undefined;
    }
  
    this.organization.country = country.name;
    this.selectedCountry = country;
  
    this.states =
      this.locationService.getStatesByCountryCode(country.isoCode);
  }

  async updateOrganization(id: any, organization: any): Promise<any> {
    console.log(organization);
    await this.organizationService.updateOrganization(id, organization)
      .subscribe({
        next: (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('organization_updated'),
            life: 3000
          });
          console.log(response);
          this.loadOrganization();
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_organization'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      });
  }

  async addOrganization(data: any): Promise<any> {
    await this.organizationService.saveOrganization(data)
      .subscribe({
        next: (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('organization_added'),
            life: 3000
          });
          console.log(response);
          this.loadOrganization();
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_organization'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      });
  }

  async onFileUpload(event: any): Promise<void> {
    const file = event.files[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_image_format'),
        life: 3000,
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5000000) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('image_too_large'),
        life: 3000,
      });
      return;
    }

    // Show loading state
    this.isImageLoading = true;

    // Create preview
    this.imagePreviewUrl = URL.createObjectURL(file);
    this.logoImageUrl = URL.createObjectURL(file);

    // Store the file for upload
    this.uploadedFile = file;

    // Auto-hide loading after a brief moment (image load event will handle it)
    setTimeout(() => {
      if (this.isImageLoading) this.isImageLoading = false;
    }, 2000);
  }

  // Drag and drop handlers
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];

      // Create a mock event object for the fileUpload method
      this.onFileUpload({ files: [file] });
    }
  }

  // Image error handler
  onImageError(): void {
    this.isImageLoading = false;
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('error'),
      detail: this.translate.instant('image_load_error'),
      life: 3000,
    });

    // Fallback to default image
    this.imagePreviewUrl = null;
    this.organization.logo = 'assets/core-images/no-image.png';
  }

  // Zoom image
  zoomImage(): void {
    this.imageZoomDialog = true;
  }

  // Select recent image
  selectRecentImage(imageUrl: string): void {
    this.organization.logo = imageUrl;
    this.imagePreviewUrl = null;
    this.logoImageUrl = null;
    this.uploadedFile = null;
  }

  editImage(): void {
    this.clearImage();
  }

  removeImage(): void {
    this.clearImage();
  }

  clearImage(): void {
    this.logoImageUrl = null;
    this.imagePreviewUrl = null;
    this.organization.logo = null;
    this.uploadedFile = null;
  }

  /**
   * Get the full locale name from locale code
   * @param localeCode The locale code (e.g., 'en', 'fr', 'ar', 'es')
   * @returns The full locale name (e.g., 'English', 'Français', etc.)
   */
  getLocaleName(localeCode: string | null | undefined): string {
    if (!localeCode) {
      return 'English'; // Default to English
    }
    
    const locale = this.availableLocales.find(loc => loc.value.toLowerCase() === localeCode.toLowerCase());
    return locale ? locale.label : localeCode.toUpperCase();
  }

}

