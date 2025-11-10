import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Message, MessageService } from 'primeng/api';
import { Product } from 'src/app/models/product';
import { ProductPriceHistory } from 'src/app/models/productPriceHistory';
import { ProductService } from 'src/app/services/product.service';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css'],
})
export class ProductDetailsComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() product!: Product | null;
  @Input() canEdit = false;
  @Input() canDelete = false;
  @Input() isAdmin = false;
  @Input() currency = 'USD';

  // 👇 Instead of events, use function inputs for parent methods
  @Input() getQuantitySeverityFn!: (qty: number) => string;
  @Input() getMeasureUnitFn!: (unit: any, qty: number) => string;
  @Input() calculateProfitFn!: (product: Product) => number;
  @Input() displayAttributeValueFn!: (attr: any) => string;

  // Action events
  @Output() onEdit = new EventEmitter<Product>();
  @Output() onDelete = new EventEmitter<Product>();
  @Output() onArchive = new EventEmitter<Product>();

  profitChartData: any;
  chartOptions: any;

  printOptions: any[] = [];

  productPriceHistory: ProductPriceHistory[] = [];

  constructor(
    private productService: ProductService,
    private messageService: MessageService,
    private translate: TranslateService) {
    this.printOptions = [
      {
        label: this.translate.instant('standard_label'),
        icon: 'pi pi-tag',
        command: () => this.productService.printLabel(this.product, 'STANDARD')
      },
      {
        label: this.translate.instant('barcode_label'),
        icon: 'pi pi-qrcode',
        command: () => this.productService.printLabel(this.product, 'BARCODE')
      },
      {
        label: this.translate.instant('shipping_label'),
        icon: 'pi pi-truck',
        command: () => this.productService.printLabel(this.product, 'SHIPPING')
      }
    ];

  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && this.product) {
      this.updateChart();
    }

    // ✅ When dialog becomes visible, load the product's price history
    if (changes['visible'] && this.visible && this.product?.productId) {
      this.onGetProductPriceHistory(this.product.productId);
    }
  }

  updateChart() {
    console.log(this.product)
    if (!this.product || !this.calculateProfitFn) return;

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

  closeDialog() {
    this.visible = false;
    this.visibleChange.emit(false);
  }
  onDialogHide() {
    this.visible = false;
    this.visibleChange.emit(false);
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
}
