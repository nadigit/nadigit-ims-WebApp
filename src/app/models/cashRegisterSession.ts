import { CashRegister } from "./cashRegister";

export interface CashRegisterSession {
    sessionId?: number;
    cashRegister?: CashRegister;
    userId?: string;
    username?: string;
    fullName?: string;
    openedAt?: string | Date;
    closedAt?: string | Date;
    openingAmount?: number;
    closingAmount?: number;
    declaredDifference?: number;
    closed?: boolean;
    notes?: string;
}
