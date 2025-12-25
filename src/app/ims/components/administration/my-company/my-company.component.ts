import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { TreeNode } from 'primeng/api';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { LocationService } from 'src/app/services/location.service';
import { firstValueFrom } from 'rxjs';

@Component({
  templateUrl: './my-company.component.html',
  styleUrls: ['./my-company.component.css', '../administration.component.css'],
  providers: [MessageService]
})
export class MyCompanyComponent implements OnInit {

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

  constructor(
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private organizationService: OrganizationService,
    private translate: TranslateService,
    private locationService: LocationService,
    private translateService: TranslationService,
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.imageLoading = true;
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();
    });

    this.loadOrganization();

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
              children: this.organization.shops.map(shop => ({ label: shop.shopName }))
            },
            {
              expanded: true,
              type: 'warehouses',
              data: { name: translations['warehouses_menu_title'] },
              children: this.organization.warehouses.map(warehouse => ({ label: warehouse.name }))
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
      this.organizationDialog = true;
      console.log(event);
    }
  }

  hideDialog() {
    this.organizationDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  async saveOrganization() {
    this.submitted = true;

    // Check if the organization name is provided
    if (this.organization.organizationName) {
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
          } else {
          }
        } catch (error) {
          console.error('Error uploading file:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_uploading_logo'),
            life: 3000
          });
          return; // Exit if there's an error
        }
      }

      // Proceed with saving/updating organization data
      try {
        if (this.organization.organizationId) {
          await this.organizationService.updateOrganization(this.organization.organizationId, this.organization).toPromise();
        } else {
          await this.organizationService.saveOrganization(this.organization).toPromise();
        }
      } catch (error) {
        console.error('Error while saving organization:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_saving_organization'),
          life: 3000
        });
      }

      // Reset and reload data
      this.organizationDialog = false; // Close the dialog
      this.organization = {}; // Reset organization object
      this.loadOrganization(); // Reload organization data
    }
  }

  getLogoImage(path: string) {
    this.imageLoading = true;
    console.log("path: " + path)
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
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_fetching_logo_image'),
        life: 3000
      });
    });
  }

  onChangeCountry() {
    this.organization.city = undefined;
  }

  onSelectedCountry(event: any) {
    console.log(event.value);
    if ((this.organization.country != this.selectedCountry) && (this.organization.city == undefined)) this.organization.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    console.log(this.selectedCountry.isoCode);
    this.states = this.locationService.getStatesByCountryCode(this.selectedCountry.isoCode);
  }

  filterCountry(value: any, filter: string): boolean {
    // Convert both to lowercase for case-insensitive comparison
    const normalizedFilter = filter.toLowerCase();

    // Check both original name and translated name
    return (
      value.name.toLowerCase().includes(normalizedFilter) ||
      value.translatedName.toLowerCase().includes(normalizedFilter)
    );
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

}

