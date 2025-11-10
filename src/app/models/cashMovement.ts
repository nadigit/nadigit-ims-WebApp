import { CashRegister } from "./cashRegister";
import { CashRegisterSession } from "./cashRegisterSession";

export interface CashMovement {
    id?: number;
    cashRegister?: CashRegister;
    session?: CashRegisterSession;
    type?: string;
    amount?: number;
    reference?: string;
    timestamp?: string | Date; // Closing time in HH:mm format
    performedById?: string;
    performedByName?: string;
}