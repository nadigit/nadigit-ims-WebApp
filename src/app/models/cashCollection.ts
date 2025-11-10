import { CashRegister } from "./cashRegister";

export interface CashCollection {
    id?: number;
    cashRegister?: CashRegister;
    collectedAt?: string | Date;
    amountCollected?: number;
    collectedById?: string;
    collectedByName?: string;
    receiptNumber?: string;
    notes?:string;
}