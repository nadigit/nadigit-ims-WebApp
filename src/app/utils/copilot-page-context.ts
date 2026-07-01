import { NadiPilotPageContext } from '../services/ai-integration.service';

/**
 * Maps the active Angular route to a lightweight page context so NadiPilot can resolve references
 * like "this product" / "this page". Detail routes capture the trailing numeric id as entityId.
 * The list order matters: more specific (detail) patterns come before their list patterns.
 */
const ROUTE_PATTERNS: Array<{ re: RegExp; type?: string; label: string }> = [
  { re: /^\/inventory\/products\/(\d+)/, type: 'product', label: 'Product details' },
  { re: /^\/inventory\/products/, label: 'Products' },
  { re: /^\/inventory\/categories\/(\d+)/, type: 'category', label: 'Category details' },
  { re: /^\/inventory\/categories/, label: 'Categories' },
  { re: /^\/inventory\/warehouses\/(\d+)/, type: 'warehouse', label: 'Warehouse details' },
  { re: /^\/inventory\/warehouses/, label: 'Warehouses' },
  { re: /^\/inventory\/warehouse-transfers\/(\d+)/, type: 'warehouseTransfer', label: 'Warehouse transfer details' },
  { re: /^\/inventory\/warehouse-transfers/, label: 'Warehouse transfers' },
  { re: /^\/inventory\/write-offs\/(\d+)/, type: 'writeOff', label: 'Write-off details' },
  { re: /^\/inventory\/write-offs/, label: 'Inventory write-offs' },
  { re: /^\/inventory\/stock-movements/, label: 'Stock movements' },
  { re: /^\/inventory\/shops\/(\d+)/, type: 'shop', label: 'Shop details' },

  { re: /^\/purchases\/purchases\/(\d+)/, type: 'purchase', label: 'Purchase details' },
  { re: /^\/purchases\/purchases/, label: 'Purchases' },
  { re: /^\/purchases\/suppliers\/(\d+)/, type: 'supplier', label: 'Supplier details' },
  { re: /^\/purchases\/suppliers/, label: 'Suppliers' },
  { re: /^\/purchases\/purchase-returns\/(\d+)/, type: 'purchaseReturn', label: 'Purchase return details' },
  { re: /^\/purchases\/purchase-returns/, label: 'Purchase returns' },

  { re: /^\/sales\/orders\/(\d+)/, type: 'order', label: 'Order details' },
  { re: /^\/sales\/orders/, label: 'Sales orders' },
  { re: /^\/sales\/customers\/(\d+)/, type: 'customer', label: 'Customer details' },
  { re: /^\/sales\/customers/, label: 'Customers' },
  { re: /^\/sales\/returns\/(\d+)/, type: 'orderReturn', label: 'Order return details' },
  { re: /^\/sales\/returns/, label: 'Order returns' },

  { re: /^\/finance\/expenses\/(\d+)/, type: 'expense', label: 'Expense details' },
  { re: /^\/finance\/expenses/, label: 'Expenses' },
  { re: /^\/finance\/refunds\/(\d+)/, type: 'refund', label: 'Refund details' },
  { re: /^\/finance\/refunds/, label: 'Refunds' },
  { re: /^\/finance\/treasury/, label: 'Treasury' },
  { re: /^\/finance\/banking/, label: 'Banking' },
  { re: /^\/finance/, label: 'Finance' },

  { re: /^\/reports\/inventory/, label: 'Inventory report' },
  { re: /^\/reports\/forecasting/, label: 'Forecasting report' },
  { re: /^\/reports\/top-products/, label: 'Top products report' },
  { re: /^\/reports\/sales/, label: 'Sales report' },
  { re: /^\/reports\/purchases/, label: 'Purchases report' },
  { re: /^\/reports\/profit/, label: 'Profit report' },
  { re: /^\/reports\/credit/, label: 'Credit report' },
  { re: /^\/reports/, label: 'Reports' },

  { re: /^\/administration\/settings/, label: 'Settings' },
  { re: /^\/administration\/users/, label: 'Users' },
  { re: /^\/administration/, label: 'Administration' },

  { re: /^\/profile/, label: 'Profile' },
  { re: /^\/notifications/, label: 'Notifications' },
];

export function buildCopilotPageContext(rawUrl: string | null | undefined): NadiPilotPageContext | undefined {
  const url = (rawUrl || '').split('?')[0].split('#')[0].trim();
  if (!url) {
    return undefined;
  }
  if (url === '/' || url === '') {
    return { route: '/', label: 'Dashboard' };
  }
  for (const pattern of ROUTE_PATTERNS) {
    const match = pattern.re.exec(url);
    if (match) {
      const ctx: NadiPilotPageContext = { route: url, label: pattern.label };
      if (pattern.type) {
        ctx.entityType = pattern.type;
        const id = match[1] ? Number(match[1]) : NaN;
        if (!Number.isNaN(id)) {
          ctx.entityId = id;
        }
      }
      return ctx;
    }
  }
  return { route: url };
}
