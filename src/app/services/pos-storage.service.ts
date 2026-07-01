import { Injectable } from '@angular/core';
import { POSCartDTO, POSSessionDTO } from '../models/pos';

export interface PendingSale {
  localSaleId: string;
  cart: POSCartDTO;
  checkoutDto: any;
  timestamp: string;
  synced: boolean;
  error?: string;
}

export interface PosLocalState {
  session: POSSessionDTO | null;
  cart: POSCartDTO | null;
  holdCarts: POSCartDTO[];
  shopId: number | null;
  quickProducts: any[];
  lastSynced: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class PosStorageService {
  private readonly SESSION_KEY = 'pos_session';
  private readonly CART_KEY = 'pos_cart';
  private readonly HOLDCARTS_KEY = 'pos_holdcarts';
  private readonly SHOPID_KEY = 'pos_shopid';
  private readonly QUICKPRODUCTS_KEY = 'pos_quickproducts';
  private readonly PENDINGSALES_KEY = 'pos_pendingsales';
  private readonly FULLSCREEN_KEY = 'pos_fullscreen';
  private readonly LASTSYNC_KEY = 'pos_lastsync';
  private readonly WAREHOUSEID_KEY = 'pos_warehouseid';

  // Session & Cart
  saveSession(session: POSSessionDTO | null): void {
    if (session) {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  getSession(): POSSessionDTO | null {
    const data = localStorage.getItem(this.SESSION_KEY);
    return data ? JSON.parse(data) : null;
  }

  saveCart(cart: POSCartDTO | null): void {
    if (cart) {
      localStorage.setItem(this.CART_KEY, JSON.stringify(cart));
    } else {
      localStorage.removeItem(this.CART_KEY);
    }
  }

  getCart(): POSCartDTO | null {
    const data = localStorage.getItem(this.CART_KEY);
    return data ? JSON.parse(data) : null;
  }

  saveHoldCarts(carts: POSCartDTO[]): void {
    localStorage.setItem(this.HOLDCARTS_KEY, JSON.stringify(carts));
  }

  getHoldCarts(): POSCartDTO[] {
    const data = localStorage.getItem(this.HOLDCARTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  saveShopId(shopId: number | null): void {
    if (shopId) {
      localStorage.setItem(this.SHOPID_KEY, shopId.toString());
    } else {
      localStorage.removeItem(this.SHOPID_KEY);
    }
  }

  getShopId(): number | null {
    const data = localStorage.getItem(this.SHOPID_KEY);
    return data ? +data : null;
  }

  saveWarehouseId(warehouseId: number | null): void {
    if (warehouseId) {
      localStorage.setItem(this.WAREHOUSEID_KEY, warehouseId.toString());
    } else {
      localStorage.removeItem(this.WAREHOUSEID_KEY);
    }
  }

  getWarehouseId(): number | null {
    const data = localStorage.getItem(this.WAREHOUSEID_KEY);
    return data ? +data : null;
  }

  saveQuickProducts(products: any[]): void {
    localStorage.setItem(this.QUICKPRODUCTS_KEY, JSON.stringify(products));
  }

  getQuickProducts(): any[] {
    const data = localStorage.getItem(this.QUICKPRODUCTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  // Pending Sales (offline)
  savePendingSale(sale: PendingSale): void {
    const sales = this.getPendingSales();
    sales.push(sale);
    localStorage.setItem(this.PENDINGSALES_KEY, JSON.stringify(sales));
  }

  getPendingSales(): PendingSale[] {
    const data = localStorage.getItem(this.PENDINGSALES_KEY);
    return data ? JSON.parse(data) : [];
  }

  removePendingSale(localSaleId: string): void {
    const sales = this.getPendingSales().filter(s => s.localSaleId !== localSaleId);
    localStorage.setItem(this.PENDINGSALES_KEY, JSON.stringify(sales));
  }

  markSaleSynced(localSaleId: string, error?: string): void {
    const sales = this.getPendingSales();
    const sale = sales.find(s => s.localSaleId === localSaleId);
    if (sale) {
      sale.synced = !error;
      sale.error = error;
      localStorage.setItem(this.PENDINGSALES_KEY, JSON.stringify(sales));
    }
  }

  getUnsyncedSales(): PendingSale[] {
    return this.getPendingSales().filter(s => !s.synced);
  }

  // Fullscreen preference
  saveFullscreenPreference(isFullscreen: boolean): void {
    localStorage.setItem(this.FULLSCREEN_KEY, isFullscreen.toString());
  }

  getFullscreenPreference(): boolean {
    const data = localStorage.getItem(this.FULLSCREEN_KEY);
    return data === 'true';
  }

  // Last sync timestamp
  saveLastSync(): void {
    localStorage.setItem(this.LASTSYNC_KEY, new Date().toISOString());
  }

  getLastSync(): string | null {
    return localStorage.getItem(this.LASTSYNC_KEY);
  }

  // Clear all POS data
  clearAll(): void {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.CART_KEY);
    localStorage.removeItem(this.HOLDCARTS_KEY);
    localStorage.removeItem(this.SHOPID_KEY);
    localStorage.removeItem(this.QUICKPRODUCTS_KEY);
    localStorage.removeItem(this.PENDINGSALES_KEY);
    localStorage.removeItem(this.LASTSYNC_KEY);
  }
}

