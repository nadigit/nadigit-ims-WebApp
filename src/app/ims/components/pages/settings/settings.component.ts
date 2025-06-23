import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MenuItem, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { TreeNode } from 'primeng/api';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { Country, State } from 'country-state-city';
import { AppConfiguration } from 'src/app/models/appConfiguration';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { currencies } from 'currencies.json';


interface UploadEvent {
  originalEvent: Event;
  files: File[];
}

@Component({
  templateUrl: './settings.component.html',
  providers: [MessageService]
})
export class SettingsComponent implements OnInit {

  submitted: boolean = false;
  organizationDialog: boolean = false;
  rowsPerPageOptions = [20, 50, 100];
  valSwitch: boolean = false;
  organization: Organization = {}
  menuItems: MenuItem[] | undefined;
  activeItem: MenuItem | undefined;
  activeIndex: number = 0;
  organizationSteps: MenuItem[] | undefined;
  selectedNodes!: TreeNode[];
  organizationStructure: any;
  countries: any = Country.getAllCountries();
  currenciesList: any = currencies;
  printingFormats: any;
  selectedCountry: any = null;
  states: any = null;
  uploadedFile: File | null = null;
  imageURL: any;
  isEditMode = false; // Flag to track edit mode
  fields: any;
  configs: AppConfiguration[] = [];
  appConfigCurrency: any = null;
  taxPercentage: number;
  isLoading: boolean = true;
  selectedLogo: File | null = null;
  selectedLogoUrl: string | null = null;
  logoImageUrl: string | undefined; // Declare the logoImageUrl property
  imageLoading: boolean = true;
  autoOrderCompleteChecked: boolean = false;

  constructor(
    private messageService: MessageService,
    private organizationService: OrganizationService,
    private appConfigService: AppConfigurationService,
    private translate: TranslateService,
    private translateService: TranslationService,) {

    this.organizationSteps = [
      {
        label: 'organization_info_lbl',
        // command: () => showUserRoleMapping()
      },
      {
        label: 'shops_menu_title',
        command: (event: any) => console.log(event.item.label)
      },
      {
        label: 'warehouses_menu_title',
        command: (event: any) => console.log(event.item.label)
      },

    ];

    


  }

  async ngOnInit() {
    this.isLoading = true;
    this.imageLoading = true;
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });

    const translations = await this.translate.get(['organization_title', 'global_parameters','a4','receipt']).toPromise();

    this.menuItems = [
      {
        label: translations['organization_title'],
        icon: 'pi pi-fw pi-sitemap',
      },
      {
        label: translations['global_parameters'],
        icon: 'pi pi-fw pi-sliders-h',
      },
    ];

    this.printingFormats = [
      {
        label: translations['a4'],
        value: 'a4',
      },
      {
        label: translations['receipt'],
        value: 'receipt',
      },
    ];

    this.loadOrganization();
    this.loadConfigs();

    this.activeItem = this.menuItems[0];

  }

  onActiveIndexChange(event: number) {
    this.activeIndex = event;
  }

  onActiveItemChange(event: MenuItem) {
    this.activeItem = event;
    console.log(this.activeItem);
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  clear(table: Table) {
    table.clear();
  }

  toggleEditMode(field: AppConfiguration) {
    if (field.isEditing) {
      this.saveConfig(field);
    }
    field.isEditing = !field.isEditing; // Toggle edit mode for the clicked field
    this.configs = [...this.configs]; // Create a new array reference to trigger change detection
  }

  async loadConfigs(): Promise<void> {
    (await this.appConfigService.getAllConfigurations()).subscribe((params: AppConfiguration[]) => {
      this.configs = params.sort((a, b) => a.id - b.id);

      // Find the tax configuration and initialize taxPercentage
      const taxConfig = this.configs.find(config => config.key === 'tax');

      const autoOrderComplete = this.configs.find(config => config.key === 'autoOrderComplete');

      if (taxConfig) {
        // Convert the string to a number and multiply by 100
        this.taxPercentage = parseFloat(taxConfig.value) * 100; // Convert to percentage (e.g., 0.2 to 20)
      }

      if (autoOrderComplete) {
        this.autoOrderCompleteChecked ? true : false;
        console.log(this.autoOrderCompleteChecked);
      }

      this.appConfigCurrency = this.configs.find(config => config.key === 'currency');
      console.log(this.configs);
    });
  }

  trackByConfig(index: number, config: AppConfiguration): number {
    return config.id; // or config.key if that's unique
  }

  getPrintingFormatLabel(value: string): string {
    const format = this.printingFormats.find(f => f.value === value);
    return format ? format.label : value;
  }

  saveConfig(field: AppConfiguration) {
    console.log(field);
    delete field.isEditing;
    console.log(field);
    const config = this.configs.find(c => c.key === field.key);
    console.log(config);
    if (config) {
      config.value = field.value;
      this.updateConfig(config);
    }
  }

  async updateConfig(config: AppConfiguration): Promise<void> {
    console.log(config);
    (await this.appConfigService.saveConfiguration(config)).subscribe({
      next: (response: AppConfiguration) => {
        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Configuration Updated', life: 3000 });
        this.loadConfigs();
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating configuration', life: 3000 });
      }
    });
  }

  onTaxChange(value: number) {
    // Convert percentage (e.g., 20) back to decimal (e.g., 0.2) and update the config value
    const taxConfig = this.configs.find(config => config.key === 'tax');
    if (taxConfig) {
      // Convert the result back to string and update the value
      taxConfig.value = (value / 100).toString();
    }
  }

  async loadOrganization(): Promise<void> {
    try {
      const translations = await this.translate.get(['shops_menu_title', 'warehouses_menu_title']).toPromise();
  
      this.organizationService.getOrganization().subscribe(data => {
        this.organization = data;
  
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
                data: {
                  name: translations['shops_menu_title'],
                },
                children: this.organization.shops.map(shop => ({
                  label: shop.shopName
                }))
              },
              {
                expanded: true,
                type: 'warehouses',
                data: {
                  name: translations['warehouses_menu_title'],
                },
                children: this.organization.warehouses.map(warehouse => ({
                  label: warehouse.name
                }))
              }
            ]
          }
        ];
  
        this.isLoading = false;
        this.getLogoImage(this.organization.logo);
      });
    } catch (error) {
      console.error('Error loading translations or organization data:', error);
      this.isLoading = false;
    }
  }
  

  editImage() {
    this.organization.logo = null;
    this.uploadedFile = null;
  }

  async openOrganizationDialog(event: any): Promise<void> {
    if (event.node.data.title === 'Organization') {
      this.getLogoImage(this.organization.logo)
      this.organizationDialog = true;
      console.log(event);
    }
  }

  hideDialog() {
    this.organizationDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  // async saveOrganization() {
  //   this.submitted = true;
  //   if (this.organization.organizationName) {
  //     // If the uploadedFile is set, proceed with uploading to Firebase Storage
  //     if (this.uploadedFile) {
  //       const filePath = `images/organization/logo/${this.uploadedFile.name}`;
  //       const fileRef = this.storage.ref(filePath);
  //       const task = this.storage.upload(filePath, this.uploadedFile);

  //       try {
  //         await lastValueFrom(task.snapshotChanges());
  //         const url = await lastValueFrom(fileRef.getDownloadURL());
  //         this.organization.logo = url;
  //         this.uploadedFile = null;
  //       } catch (error) {
  //         console.error('Error uploading file:', error);
  //       }
  //     }
  //     if (this.organization.organizationId) {
  //       this.updateOrganization(this.organization.organizationId, this.organization) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Organization Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating organization', life: 3000 });
  //     } else {
  //       this.addOrganization(this.organization) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Organization Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding organization', life: 3000 });
  //     }
  //     this.organizationDialog = false;
  //     this.organization = {};
  //     this.loadOrganization();
  //   }
  // }

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
          } else {
          }
        } catch (error) {
          console.error('Error uploading file:', error);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while uploading logo', life: 3000 });
          return; // Exit if there's an error
        }
      }

      // Proceed with saving/updating organization data
      try {
        if (this.organization.organizationId) {
          await this.organizationService.updateOrganization(this.organization.organizationId, this.organization).toPromise();
          this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Organization Updated', life: 3000 });
        } else {
          await this.organizationService.saveOrganization(this.organization).toPromise();
          this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Organization Created', life: 3000 });
        }
      } catch (error) {
        console.error('Error while saving organization:', error);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while saving organization', life: 3000 });
      }

      // Reset and reload data
      this.organizationDialog = false; // Close the dialog
      this.organization = {}; // Reset organization object
      this.loadOrganization(); // Reload organization data
    }
  }


  onFileUpload(event: any) {
    const file = event.files[0];
    if (file) {
      this.uploadedFile = file; // Store selected file
      const reader = new FileReader();
      reader.onload = () => {
        this.logoImageUrl = reader.result as string; // Temporary preview
      };
      reader.readAsDataURL(file);
    }
  }
  // Method to upload logo
  uploadLogo() {
    if (this.selectedLogo) {
      this.organizationService.uploadLogo(this.selectedLogo).subscribe(
        response => {
          console.log('Logo uploaded and path saved:', response);
          // Optionally, refresh organization data to show the new logo
        },
        error => {
          console.error('Error uploading logo:', error);
        }
      );
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
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);
  }

  async updateOrganization(id: any, organization: any): Promise<any> {
    console.log(organization);
    await this.organizationService.updateOrganization(id, organization)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.loadOrganization();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      });
  }

  async addOrganization(data: any): Promise<any> {
    await this.organizationService.saveOrganization(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.loadOrganization();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      });
  }

  // async onFileUpload(event: UploadEvent): Promise<void> {
  //   console.log("in upload");
  //   const file = event.files[0];
  //   this.imageURL = URL.createObjectURL(file);
  //   this.uploadedFile = file;
  // }



}
