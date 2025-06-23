import { Shop } from "./shop";
import { Warehouse } from "./warehouse";

export class Organization { 
    organizationId?: number;
    organizationName?: string;
    address?: string;
    country?: string;
    city?: string;
    email?: string;
    phoneNumber?: string;
    logo?: string;
    website?: string;
    taxID?: string;
    commercialRegister?: string;
    license?: string;
    ice?: string;
    socialSecurityId?: string;
    bankAccountId?: string;
    warehouses?: Array<Warehouse>;
    shops?: Array<Shop>;
    creationDate?: Date;
} 
