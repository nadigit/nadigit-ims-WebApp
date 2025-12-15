import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Product } from 'src/app/models/product';
import { ProductPriceHistory } from 'src/app/models/productPriceHistory';
import { ProductService } from 'src/app/services/product.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { firstValueFrom } from 'rxjs';
import { getMeasureUnit } from 'src/app/shared/product-utils';

@Component({
  selector: 'app-product-details-page',
  templateUrl: './product-details-page.component.html',
  styleUrls: ['./product-details-page.component.css', '../products.component.css']
})
export class ProductDetailsPageComponent implements OnInit {
  productId!: number;
  product: Product | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "PRODUCTS";

  profitChartData: any;
  chartOptions: any;
  printOptions: any[] = [];
  productPriceHistory: ProductPriceHistory[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private productService: ProductService,
    private messageService: MessageService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService
  ) {
    this.printOptions = [
      {
        label: this.translate.instant('standard_label'),
        icon: 'pi pi-tag',
        command: () => this.productService.printLabel(this.product!, 'STANDARD')
      },
      {
        label: this.translate.instant('barcode_label'),
        icon: 'pi pi-qrcode',
        command: () => this.productService.printLabel(this.product!, 'BARCODE')
      },
      {
        label: this.translate.instant('shipping_label'),
        icon: 'pi pi-truck',
        command: () => this.productService.printLabel(this.product!, 'SHIPPING')
      }
    ];
  }

  async ngOnInit() {
    this.isLoading = true;
    
    // Load token first
    this.productService.loadToken();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.productId = +params['id'];
      if (!this.productId || isNaN(this.productId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_product_id'),
          life: 3000
        });
        this.router.navigate(['/inventory/products']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadProduct();
    });
  }

  async loadProduct(): Promise<void> {
    try {
      // Ensure token is loaded
      this.productService.loadToken();
      
      const response = await firstValueFrom(this.productService.getProduct(this.productId));
      console.log('Product API response:', response);
      
      // Handle different response formats
      if (Array.isArray(response)) {
        // If API returns an array, take the first item
        this.product = response[0] as Product;
      } else if (response && typeof response === 'object') {
        // If API returns an object directly
        this.product = response as Product;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.product || !this.product.productId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('product_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/products']);
        return;
      }

      this.updateChart();
      this.onGetProductPriceHistory(this.product.productId);
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading product:', error);
      this.isLoading = false;
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_loading_product');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 3000
      });
      // Don't navigate away immediately, let user see the error
      setTimeout(() => {
        this.router.navigate(['/inventory/products']);
      }, 2000);
    }
  }

  updateChart() {
    if (!this.product) return;

    const profitValue = this.product.sellingPrice - this.product.buyingPrice;
    const costLabel = this.translate.instant('cost');
    const profitLabel = this.translate.instant('profit');

    this.profitChartData = {
      labels: [costLabel, profitLabel],
      datasets: [
        {
          data: [this.product.buyingPrice, profitValue],
          backgroundColor: ['#42A5F5', '#66BB6A'],
          hoverBackgroundColor: ['#64B5F6', '#81C784']
        }
      ]
    };

    this.chartOptions = {
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    };
  }

  onGetProductPriceHistory(productId: number): void {
    this.productService.getProductPriceHistory(productId).subscribe({
      next: (response: any) => {
        this.productPriceHistory = response;
        console.log('Product price history loaded:', this.productPriceHistory);
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_price_history'),
          life: 3000,
        });
        console.error('Error fetching product price history:', err);
      },
    });
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canEdit = this.permissionService.canUpdate(this.Ressource);
    this.canDelete = this.permissionService.canDelete(this.Ressource);
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  getQuantitySeverity(quantity: number): string {
    if (quantity === undefined || quantity === null) return 'info';
    if (quantity <= 0) return 'danger';
    return 'success';
  }

  getMeasureUnit(unit: string, quantity: number): string {
    return getMeasureUnit(unit, quantity);
  }

  calculateProfit(product: Product): number {
    if (!product.sellingPrice || !product.buyingPrice) return 0;
    return (product.sellingPrice - product.buyingPrice) / product.buyingPrice;
  }

  displayAttributeValue(attr: any): string {
    if (!attr) return '';
    switch (attr.attributeType) {
      case 'BOOLEAN':
        return attr.booleanValue ? 'Yes' : 'No';
      case 'INTEGER':
        return attr.intValue?.toString() || '';
      case 'DOUBLE':
        return attr.doubleValue?.toFixed(2) || '';
      default:
        return attr.stringValue || '';
    }
  }

  goBack(): void {
    this.location.back();
  }

  editProduct(): void {
    // Navigate to edit page or open edit dialog
    // For now, just navigate back to products with edit mode
    this.router.navigate(['/inventory/products'], { queryParams: { edit: this.productId } });
  }

  deleteProduct(): void {
    // Handle delete - could show confirmation dialog first
    if (confirm(this.translate.instant('delete_confirmation_msg_with_param').replace('{0}', this.product?.name || ''))) {
      this.productService.deleteProduct(this.productId).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_deleted'),
            life: 3000
          });
          this.router.navigate(['/inventory/products']);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_deleting_product'),
            life: 3000
          });
        }
      });
    }
  }

  archiveProduct(): void {
    if (confirm(this.translate.instant('archive_confirmation_msg_with_param').replace('{0}', this.product?.name || ''))) {
      this.productService.deactivateProduct(this.productId).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_archived'),
            life: 3000
          });
          this.router.navigate(['/inventory/products']);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_archiving_product'),
            life: 3000
          });
        }
      });
    }
  }
}

