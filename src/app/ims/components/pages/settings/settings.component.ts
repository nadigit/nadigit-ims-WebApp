import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MenuItem, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { TreeNode } from 'primeng/api';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { Country, State } from 'country-state-city';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { lastValueFrom } from 'rxjs';
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
  selectedCountry: any = null;
  states: any = null;
  uploadedFile: File | null = null;
  imageURL: any;
  isEditMode = false; // Flag to track edit mode
  fields: any;
  configs: AppConfiguration[] = [];
  appConfigCurrency: any = null;

  constructor(
    private messageService: MessageService,
    private organizationService: OrganizationService,
    private appConfigService: AppConfigurationService,
    private translate: TranslateService,
    private storage: AngularFireStorage,
    private translateService: TranslationService,
    private cdr: ChangeDetectorRef) {

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

  ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    
    this.loadOrganization();
    this.loadConfigs();

    this.menuItems = [
      {
        label: 'Organization',
        icon: 'pi pi-fw pi-sitemap',
      },
      {
        label: 'Customization',
        icon: 'pi pi-fw pi-sliders-h',
      },
    ];

    this.activeItem = this.menuItems[0];

    // this.organizationSteps = [
    //   {
    //     label: 'Organization Information',
    //     // command: () => showUserRoleMapping()
    //   },
    //   {
    //     label: 'Magasins',
    //     command: (event: any) => console.log(event.item.label)
    //   },
    //   {
    //     label: 'Warehouses',
    //     command: (event: any) => console.log(event.item.label)
    //   },
    // ];
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

  loadConfigs(): void {
    this.appConfigService.getAllConfigurations().subscribe((params: AppConfiguration[]) => {
      this.configs = params.sort((a, b) => a.id - b.id); // Sort by id or any other property that determines order
      console.log(this.configs);
    });
  }

  trackByConfig(index: number, config: AppConfiguration): number {
    return config.id; // or config.key if that's unique
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

  updateConfig(config: AppConfiguration): void {
    console.log(config);
    this.appConfigService.saveConfiguration(config).subscribe({
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

  loadOrganization(): void {
    this.organizationService.getOrganization().subscribe(data => {
      this.organization = data;
      console.log(this.organization);
      // Map the organization data to TreeNode format
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
                name: 'Shops',
              },
              children: this.organization.shops.map(shop => ({
                label: shop.shopName
              }))
            },
            {
              expanded: true,
              type: 'warehouses',
              data: {
                name: 'Warehouses',
              },
              children: this.organization.warehouses.map(warehouse => ({
                label: warehouse.name
              }))
            }
          ]
        }
      ];
    });
  }

  openOrganizationDialog(event: any): void {
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
    if (this.organization.organizationName) {
      // If the uploadedFile is set, proceed with uploading to Firebase Storage
      if (this.uploadedFile) {
        const filePath = `images/organization/logo/${this.uploadedFile.name}`;
        const fileRef = this.storage.ref(filePath);
        const task = this.storage.upload(filePath, this.uploadedFile);

        try {
          await lastValueFrom(task.snapshotChanges());
          const url = await lastValueFrom(fileRef.getDownloadURL());
          this.organization.logo = url;
          this.uploadedFile = null;
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      }
      if (this.organization.organizationId) {
        this.updateOrganization(this.organization.organizationId, this.organization) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Organization Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating organization', life: 3000 });
      } else {
        this.addOrganization(this.organization) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Organization Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding organization', life: 3000 });
      }
      this.organizationDialog = false;
      this.organization = {};
      this.loadOrganization();
    }
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

  async onFileUpload(event: UploadEvent): Promise<void> {
    console.log("in upload");
    const file = event.files[0];
    this.imageURL = URL.createObjectURL(file);
    this.uploadedFile = file;
  }
}
