import { Organization } from "./organization";
import { BankAccount } from "./bank-account";

export class Shop { 
    shopId?: number;
    shopName?: string;
    description?: string;
    city?: string;
    country?: string;
    address?: string;
    numberOfEmployees ?: number;
    organization?: Organization;
    creationDate?: Date;
    defaultBankAccount?: BankAccount;
    defaultBankAccountId?: number;
} 
