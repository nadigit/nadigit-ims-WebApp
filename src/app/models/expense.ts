import { Shop } from "./shop";

export class Expense { 
    id?: number;
    purpose?: string;
    dateOfExpense?: Date | string;
    amount?: number;
    creationDate?: Date;
    receipt?:string;
    paymentMethod?: string;
    checkNumber?: string;
    checkExpirationDate?: Date | string;
    boeNumber?: string;
    boeExpirationDate?: Date | string;
    shop?:Shop;
    status?: string;
    description?: string;
    lastUpdated?: Date | string;
    submissionDate?: Date | string;
    approvalDate?: Date | string;
    approvedBy?: string;
    reimbursementDate?: Date | string;
    reimbursedBy?: string;
    approvalNotes?: string;
} 
