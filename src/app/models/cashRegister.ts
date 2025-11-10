import { CashMovement } from "./cashMovement";
import { CashRegisterSession } from "./cashRegisterSession";
import { Shop } from "./shop";

export interface CashRegister {
    cashRegisterId?: number;
    shop?: Shop;
    totalBalance?: number;
    openingTime?: string | Date; // Opening time in HH:mm format
    closingTime?: string | Date; // Closing time in HH:mm format
    sessions?: CashRegisterSession[];
    movements?: CashMovement[];
    creationDate?: Date;
}