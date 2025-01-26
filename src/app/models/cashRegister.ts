import { DailyBalance } from "./dailyBalance";
import { Shop } from "./shop";

export interface CashRegister {
    id?: number;
    shop?: Shop;
    totalBalance?: number;
    openingTime?: string | Date; // Opening time in HH:mm format
    closingTime?: string | Date; // Closing time in HH:mm format
    dailyBalances?: DailyBalance[];
}