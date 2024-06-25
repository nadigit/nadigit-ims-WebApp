import { Organization } from "./organization";

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
} 
